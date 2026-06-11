'use strict';

const express = require('express');
const store = require('../data/store');
const { authRequired, requireRole } = require('../auth');
const { sendError, isNonEmptyString, toPositiveInt } = require('../utils/http');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_TYPE = ['OWNER', 'MAINTENANCE', 'USER'];

router.use(authRequired);

router.get('/', wrap(async (req, res) => {
  const { type, keyword } = req.query;
  const filters = {};
  if (type !== undefined) {
    if (!VALID_TYPE.includes(type)) return sendError(res, 400, '无效的单位类型');
    filters.type = type;
  }
  if (isNonEmptyString(keyword)) filters.keyword = keyword.trim();
  const list = await store.listOrganizations(filters);
  res.json({ data: list, total: list.length });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的单位 ID');
  const org = await store.getOrganization(id);
  if (!org) return sendError(res, 404, '单位不存在');
  res.json({ data: org });
}));

router.get('/:id/projects', wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的单位 ID');
  if (!(await store.getOrganization(id))) return sendError(res, 404, '单位不存在');
  const list = await store.getOrganizationProjects(id);
  res.json({ data: list, total: list.length });
}));

router.post('/', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const b = req.body || {};
  if (!isNonEmptyString(b.name)) return sendError(res, 400, '单位名称不能为空');
  if (b.type !== undefined && !VALID_TYPE.includes(b.type)) {
    return sendError(res, 400, '无效的单位类型');
  }
  if (isNonEmptyString(b.creditCode) && await store.findOrganizationByCreditCode(b.creditCode.trim())) {
    return sendError(res, 409, '统一社会信用代码已存在');
  }
  const org = await store.createOrganization({ ...b, name: b.name.trim(), creditCode: b.creditCode ? b.creditCode.trim() : '' });
  res.status(201).json({ data: org });
}));

router.put('/:id', requireRole('ADMIN', 'MANAGER'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的单位 ID');
  if (!(await store.getOrganization(id))) return sendError(res, 404, '单位不存在');
  const b = req.body || {};
  if (b.name !== undefined && !isNonEmptyString(b.name)) return sendError(res, 400, '单位名称不能为空');
  if (b.type !== undefined && !VALID_TYPE.includes(b.type)) {
    return sendError(res, 400, '无效的单位类型');
  }
  if (isNonEmptyString(b.creditCode)) {
    const existing = await store.findOrganizationByCreditCode(b.creditCode.trim());
    if (existing && existing.id !== id) {
      return sendError(res, 409, '统一社会信用代码已被其他单位使用');
    }
  }
  const updated = await store.updateOrganization(id, b);
  res.json({ data: updated });
}));

router.delete('/:id', requireRole('ADMIN'), wrap(async (req, res) => {
  const id = toPositiveInt(req.params.id);
  if (id === null) return sendError(res, 400, '无效的单位 ID');
  if (!(await store.getOrganization(id))) return sendError(res, 404, '单位不存在');
  await store.deleteOrganization(id);
  res.status(204).end();
}));

module.exports = router;
