'use strict';

const express = require('express');
const store = require('../data/store');
const { authRequired, requireRole } = require('../auth');
const { sendError, isNonEmptyString, toPositiveInt, isValidDate } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_RESP_TYPE = ['OWNER', 'MAINTENANCE', 'USER'];

router.use(authRequired);

router.get('/', wrap(async (req, res) => {
  const { projectId, organizationId, responsibilityType } = req.query;
  const filters = {};
  if (projectId !== undefined) {
    const pid = toPositiveInt(projectId);
    if (pid === null) return sendError(res, 400, '无效的工程 ID');
    filters.projectId = pid;
  }
  if (organizationId !== undefined) {
    const oid = toPositiveInt(organizationId);
    if (oid === null) return sendError(res, 400, '无效的单位 ID');
    filters.organizationId = oid;
  }
  if (responsibilityType !== undefined) {
    if (!VALID_RESP_TYPE.includes(responsibilityType)) return sendError(res, 400, '无效的责任类型');
    filters.responsibilityType = responsibilityType;
  }
  const list = await store.listResponsibilities(filters);
  res.json({ data: list, total: list.length });
}));

router.get('/dashboard', wrap(async (req, res) => {
  const days = req.query.daysBeforeExpiry ? toPositiveInt(req.query.daysBeforeExpiry) : 90;
  const dashboard = await store.getResponsibilityDashboard(days);
  res.json({ data: dashboard });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的责任关系 ID');
  const r = await store.getResponsibility(id);
  if (!r) return sendError(res, 404, '责任关系不存在');
  res.json({ data: r });
}));

router.post('/', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const b = req.body || {};
  const pid = toPositiveInt(b.projectId);
  if (pid === null) return sendError(res, 400, '必须指定有效的工程 ID');
  if (!(await store.getProject(pid))) return sendError(res, 400, '人防工程不存在');
  const oid = toPositiveInt(b.organizationId);
  if (oid === null) return sendError(res, 400, '必须指定有效的单位 ID');
  if (!(await store.getOrganization(oid))) return sendError(res, 400, '单位不存在');
  if (!VALID_RESP_TYPE.includes(b.responsibilityType)) return sendError(res, 400, '无效的责任类型');
  if (!isValidDate(b.startDate)) return sendError(res, 400, '起始日期格式必须为 YYYY-MM-DD');
  if (!isValidDate(b.endDate)) return sendError(res, 400, '截止日期格式必须为 YYYY-MM-DD');
  if (b.startDate > b.endDate) return sendError(res, 400, '起始日期不能晚于截止日期');
  try {
    const r = await store.createResponsibility({
      projectId: pid,
      organizationId: oid,
      responsibilityType: b.responsibilityType,
      startDate: b.startDate,
      endDate: b.endDate,
    });
    res.status(201).json({ data: r });
  } catch (err) {
    if (err.code === 'OVERLAP') return sendError(res, 409, err.message);
    throw err;
  }
}));

router.put('/:id', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的责任关系 ID');
  if (!(await store.getResponsibility(id))) return sendError(res, 404, '责任关系不存在');
  const b = req.body || {};
  if (b.responsibilityType !== undefined && !VALID_RESP_TYPE.includes(b.responsibilityType)) {
    return sendError(res, 400, '无效的责任类型');
  }
  if (b.startDate !== undefined && !isValidDate(b.startDate)) {
    return sendError(res, 400, '起始日期格式必须为 YYYY-MM-DD');
  }
  if (b.endDate !== undefined && !isValidDate(b.endDate)) {
    return sendError(res, 400, '截止日期格式必须为 YYYY-MM-DD');
  }
  try {
    const updated = await store.updateResponsibility(id, b);
    res.json({ data: updated });
  } catch (err) {
    if (err.code === 'OVERLAP') return sendError(res, 409, err.message);
    throw err;
  }
}));

router.delete('/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的责任关系 ID');
  if (!(await store.getResponsibility(id))) return sendError(res, 404, '责任关系不存在');
  await store.deleteResponsibility(id);
  res.status(204).end();
}));

module.exports = router;
