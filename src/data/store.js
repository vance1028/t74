'use strict';

/**
 * 数据仓储层 - 基于 MySQL（mysql2/promise）。
 * 所有方法 async，返回 camelCase 字段对象。
 */

const { pool } = require('../db');
const { hashPassword } = require('../utils/password');

/* ----------------------------- 映射 ----------------------------- */

function mapUser(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    role: r.role,
    department: r.department,
    status: r.status,
    createdAt: r.created_at,
  };
}

// 含密码哈希的内部映射，仅登录校验用，绝不直接返回给前端
function mapUserWithHash(r) {
  if (!r) return null;
  return { ...mapUser(r), passwordHash: r.password_hash };
}

function mapProject(r) {
  if (!r) return null;
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    protectionLevel: r.protection_level,
    areaSqm: Number(r.area_sqm),
    address: r.address,
    district: r.district,
    peacetimeUse: r.peacetime_use,
    status: r.status,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapEquipment(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    category: r.category,
    model: r.model,
    installDate: r.install_date,
    status: r.status,
    createdAt: r.created_at,
  };
}

function mapOrganization(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    contactPerson: r.contact_person,
    contactPhone: r.contact_phone,
    creditCode: r.credit_code,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapResponsibility(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    organizationId: r.organization_id,
    responsibilityType: r.responsibility_type,
    startDate: r.start_date,
    endDate: r.end_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapInspection(r) {
  if (!r) return null;
  return {
    id: r.id,
    projectId: r.project_id,
    inspectorId: r.inspector_id,
    inspectDate: r.inspect_date,
    type: r.type,
    result: r.result,
    issues: r.issues,
    createdAt: r.created_at,
  };
}

/* --------------------------- 初始化/重置 --------------------------- */

async function seed() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['inspections', 'project_responsibilities', 'equipments', 'projects', 'organizations', 'users']) {
      await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // 用户（密码运行时哈希）：admin/admin123, manager/manager123, inspector/inspect123
    await conn.query(
      `INSERT INTO users (id, username, password_hash, name, role, department) VALUES
        (1, 'admin', ?, '系统管理员', 'ADMIN', '人防办信息科'),
        (2, 'manager', ?, '张管理', 'MANAGER', '工程管理科'),
        (3, 'inspector', ?, '李巡检', 'INSPECTOR', '维护管理科')`,
      [hashPassword('admin123'), hashPassword('manager123'), hashPassword('inspect123')],
    );

    await conn.query(
      `INSERT INTO projects (id, code, name, type, protection_level, area_sqm, address, district, peacetime_use, status, completed_at) VALUES
        (1, 'RF-2024-001', '中心广场地下人防工程', 'COMBINED', '6', 8600.50, '人民中路1号地下', '城关区', '地下停车场', 'NORMAL', '2018-09-01'),
        (2, 'RF-2024-002', '滨江路防空地下室', 'BASEMENT', '6B', 3200.00, '滨江路88号', '江南区', '商业仓储', 'NORMAL', '2020-05-15'),
        (3, 'RF-2024-003', '老城区单建掘开式工程', 'SINGLE', '5', 5400.00, '解放街地下', '城关区', '暂未利用', 'MAINTENANCE', '2010-03-20'),
        (4, 'RF-2024-004', '科技园人员掩蔽所', 'SHELTER', '6', 2100.00, '科技大道12号地下', '高新区', '社区活动中心', 'NORMAL', '2021-11-30')`,
    );

    await conn.query(
      `INSERT INTO equipments (project_id, name, category, model, install_date, status) VALUES
        (1, '1号防护密闭门', 'PROTECTIVE_DOOR', 'HFM2030', '2018-08-01', 'NORMAL'),
        (1, '战时通风机', 'VENTILATION', 'F300', '2018-08-10', 'NORMAL'),
        (1, '柴油发电机组', 'POWER', '50GF', '2018-08-15', 'NORMAL'),
        (2, '防爆波活门', 'PROTECTIVE_DOOR', 'HK600', '2020-04-20', 'NORMAL'),
        (2, '给排水泵', 'WATER', 'WQ15', '2020-05-01', 'FAULT'),
        (3, '滤毒通风设备', 'VENTILATION', 'LD60', '2010-03-01', 'MAINTENANCE')`,
    );

    await conn.query(
      `INSERT INTO inspections (project_id, inspector_id, inspect_date, type, result, issues) VALUES
        (1, 3, '2026-05-10', 'ROUTINE', 'PASS', ''),
        (2, 3, '2026-05-12', 'ROUTINE', 'FAIL', '给排水泵故障，需更换'),
        (3, 3, '2026-04-20', 'SPECIAL', 'FAIL', '滤毒设备老化，建议大修'),
        (1, 3, '2026-06-01', 'ROUTINE', 'PASS', '')`,
    );

    await conn.query(
      `INSERT INTO organizations (id, name, type, contact_person, contact_phone, credit_code) VALUES
        (1, '城投置业有限公司', 'OWNER', '王建国', '13800001111', '91330100MA2ABC1D2E'),
        (2, '恒泰物业管理有限公司', 'MAINTENANCE', '赵明辉', '13900002222', '91330100MA2FGH3I4J'),
        (3, '华润万象生活有限公司', 'MAINTENANCE', '陈丽华', '13700003333', '91330100MA2KLM5N6P'),
        (4, '万达商业管理有限公司', 'USER', '刘伟', '13600004444', '91330100MA2QRS7T8U'),
        (5, '永辉超市股份有限公司', 'USER', '张红', '13500005555', '91330100MA2UVW9X0Y'),
        (6, '龙湖地产开发有限公司', 'OWNER', '孙强', '13300006666', '91330100MA2YZA1B2C')`,
    );

    await conn.query(
      `INSERT INTO project_responsibilities (id, project_id, organization_id, responsibility_type, start_date, end_date) VALUES
        (1,  1, 1, 'OWNER',       '2018-09-01', '9999-12-31'),
        (2,  1, 2, 'MAINTENANCE', '2018-09-01', '2024-12-31'),
        (3,  1, 3, 'MAINTENANCE', '2025-01-01', '9999-12-31'),
        (4,  1, 4, 'USER',        '2019-03-01', '2023-02-28'),
        (5,  1, 5, 'USER',        '2023-03-01', '9999-12-31'),
        (6,  2, 1, 'OWNER',       '2020-05-15', '2023-06-30'),
        (7,  2, 6, 'OWNER',       '2023-07-01', '9999-12-31'),
        (8,  2, 2, 'MAINTENANCE', '2020-05-15', '9999-12-31'),
        (9,  2, 4, 'USER',        '2020-06-01', '9999-12-31'),
        (10, 3, 1, 'OWNER',       '2010-03-20', '9999-12-31'),
        (11, 4, 6, 'OWNER',       '2021-11-30', '9999-12-31')`,
    );
  } finally {
    conn.release();
  }
}

async function isEmpty() {
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM users');
  return rows[0].cnt === 0;
}

/* ----------------------------- 用户 ----------------------------- */

async function findUserByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  return mapUserWithHash(rows[0]);
}

async function getUser(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return mapUser(rows[0]);
}

async function listUsers() {
  const [rows] = await pool.query('SELECT * FROM users ORDER BY id');
  return rows.map(mapUser);
}

async function createUser({ username, password, name = '', role = 'INSPECTOR', department = '' }) {
  const [r] = await pool.query(
    'INSERT INTO users (username, password_hash, name, role, department) VALUES (?, ?, ?, ?, ?)',
    [username, hashPassword(password), name, role, department],
  );
  return getUser(r.insertId);
}

/* ----------------------------- 人防工程 ----------------------------- */

async function listProjects({ status, district, keyword } = {}) {
  const where = [];
  const params = [];
  if (status !== undefined) { where.push('status = ?'); params.push(status); }
  if (district !== undefined) { where.push('district = ?'); params.push(district); }
  if (keyword !== undefined && keyword !== '') {
    where.push('(name LIKE ? OR code LIKE ? OR address LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM projects ${clause} ORDER BY id`, params);
  return rows.map(mapProject);
}

async function getProject(id) {
  const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [id]);
  return mapProject(rows[0]);
}

async function findProjectByCode(code) {
  const [rows] = await pool.query('SELECT * FROM projects WHERE code = ?', [code]);
  return mapProject(rows[0]);
}

async function createProject(p) {
  const [r] = await pool.query(
    `INSERT INTO projects (code, name, type, protection_level, area_sqm, address, district, peacetime_use, status, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.code, p.name, p.type || 'COMBINED', p.protectionLevel || '6', p.areaSqm || 0,
     p.address || '', p.district || '', p.peacetimeUse || '', p.status || 'NORMAL', p.completedAt || null],
  );
  return getProject(r.insertId);
}

async function updateProject(id, patch) {
  const map = {
    name: 'name', type: 'type', protectionLevel: 'protection_level', areaSqm: 'area_sqm',
    address: 'address', district: 'district', peacetimeUse: 'peacetime_use',
    status: 'status', completedAt: 'completed_at',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); params.push(patch[k]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP(3)');
    params.push(id);
    await pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getProject(id);
}

async function deleteProject(id) {
  const [r] = await pool.query('DELETE FROM projects WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

/* ----------------------------- 设备设施 ----------------------------- */

async function listEquipments(projectId) {
  const [rows] = await pool.query(
    'SELECT * FROM equipments WHERE project_id = ? ORDER BY id', [projectId]);
  return rows.map(mapEquipment);
}

async function createEquipment(e) {
  const [r] = await pool.query(
    `INSERT INTO equipments (project_id, name, category, model, install_date, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [e.projectId, e.name, e.category || 'OTHER', e.model || '', e.installDate || null, e.status || 'NORMAL'],
  );
  const [rows] = await pool.query('SELECT * FROM equipments WHERE id = ?', [r.insertId]);
  return mapEquipment(rows[0]);
}

/* ----------------------------- 检查记录 ----------------------------- */

async function listInspections({ projectId } = {}) {
  if (projectId !== undefined) {
    const [rows] = await pool.query(
      'SELECT * FROM inspections WHERE project_id = ? ORDER BY inspect_date DESC, id DESC', [projectId]);
    return rows.map(mapInspection);
  }
  const [rows] = await pool.query('SELECT * FROM inspections ORDER BY inspect_date DESC, id DESC');
  return rows.map(mapInspection);
}

async function createInspection(i) {
  const [r] = await pool.query(
    `INSERT INTO inspections (project_id, inspector_id, inspect_date, type, result, issues)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [i.projectId, i.inspectorId || null, i.inspectDate, i.type || 'ROUTINE', i.result || 'PASS', i.issues || ''],
  );
  const [rows] = await pool.query('SELECT * FROM inspections WHERE id = ?', [r.insertId]);
  return mapInspection(rows[0]);
}

/* ----------------------------- 单位档案 ----------------------------- */

async function listOrganizations({ type, keyword } = {}) {
  const where = [];
  const params = [];
  if (type !== undefined) { where.push('type = ?'); params.push(type); }
  if (keyword !== undefined && keyword !== '') {
    where.push('(name LIKE ? OR credit_code LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM organizations ${clause} ORDER BY id`, params);
  return rows.map(mapOrganization);
}

async function getOrganization(id) {
  const [rows] = await pool.query('SELECT * FROM organizations WHERE id = ?', [id]);
  return mapOrganization(rows[0]);
}

async function findOrganizationByCreditCode(creditCode) {
  const [rows] = await pool.query('SELECT * FROM organizations WHERE credit_code = ?', [creditCode]);
  return mapOrganization(rows[0]);
}

async function createOrganization(o) {
  const [r] = await pool.query(
    `INSERT INTO organizations (name, type, contact_person, contact_phone, credit_code)
     VALUES (?, ?, ?, ?, ?)`,
    [o.name, o.type || 'OWNER', o.contactPerson || '', o.contactPhone || '', o.creditCode || ''],
  );
  return getOrganization(r.insertId);
}

async function updateOrganization(id, patch) {
  const map = {
    name: 'name', type: 'type', contactPerson: 'contact_person',
    contactPhone: 'contact_phone', creditCode: 'credit_code',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); params.push(patch[k]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP(3)');
    params.push(id);
    await pool.query(`UPDATE organizations SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getOrganization(id);
}

async function deleteOrganization(id) {
  const [r] = await pool.query('DELETE FROM organizations WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

async function getOrganizationProjects(orgId) {
  const [rows] = await pool.query(
    `SELECT pr.*, p.code AS project_code, p.name AS project_name, o.name AS org_name
     FROM project_responsibilities pr
     JOIN projects p ON p.id = pr.project_id
     JOIN organizations o ON o.id = pr.organization_id
     WHERE pr.organization_id = ?
     ORDER BY pr.start_date DESC, pr.id DESC`,
    [orgId],
  );
  return rows.map((r) => ({
    ...mapResponsibility(r),
    projectCode: r.project_code,
    projectName: r.project_name,
    orgName: r.org_name,
  }));
}

/* ----------------------------- 责任关系 ----------------------------- */

async function listResponsibilities({ projectId, organizationId, responsibilityType } = {}) {
  const where = [];
  const params = [];
  if (projectId !== undefined) { where.push('pr.project_id = ?'); params.push(projectId); }
  if (organizationId !== undefined) { where.push('pr.organization_id = ?'); params.push(organizationId); }
  if (responsibilityType !== undefined) { where.push('pr.responsibility_type = ?'); params.push(responsibilityType); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT pr.*, o.name AS org_name, p.code AS project_code, p.name AS project_name
     FROM project_responsibilities pr
     JOIN organizations o ON o.id = pr.organization_id
     JOIN projects p ON p.id = pr.project_id
     ${clause} ORDER BY pr.start_date, pr.id`,
    params,
  );
  return rows.map((r) => ({
    ...mapResponsibility(r),
    orgName: r.org_name,
    projectCode: r.project_code,
    projectName: r.project_name,
  }));
}

async function getResponsibility(id) {
  const [rows] = await pool.query(
    `SELECT pr.*, o.name AS org_name, p.code AS project_code, p.name AS project_name
     FROM project_responsibilities pr
     JOIN organizations o ON o.id = pr.organization_id
     JOIN projects p ON p.id = pr.project_id
     WHERE pr.id = ?`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    ...mapResponsibility(r),
    orgName: r.org_name,
    projectCode: r.project_code,
    projectName: r.project_name,
  };
}

async function checkOverlap(projectId, responsibilityType, startDate, endDate, excludeId) {
  const [rows] = await pool.query(
    `SELECT id, start_date, end_date FROM project_responsibilities
     WHERE project_id = ? AND responsibility_type = ?
       AND start_date <= ? AND end_date >= ?
       ${excludeId ? 'AND id != ?' : ''}`,
    excludeId
      ? [projectId, responsibilityType, endDate, startDate, excludeId]
      : [projectId, responsibilityType, endDate, startDate],
  );
  return rows;
}

async function createResponsibility(data) {
  const overlaps = await checkOverlap(data.projectId, data.responsibilityType, data.startDate, data.endDate);
  if (overlaps.length > 0) {
    const conflict = overlaps[0];
    const err = new Error(`时间段与已有记录冲突（ID=${conflict.id}, ${conflict.start_date}~${conflict.end_date}）`);
    err.code = 'OVERLAP';
    err.conflict = conflict;
    throw err;
  }
  const [r] = await pool.query(
    `INSERT INTO project_responsibilities (project_id, organization_id, responsibility_type, start_date, end_date)
     VALUES (?, ?, ?, ?, ?)`,
    [data.projectId, data.organizationId, data.responsibilityType, data.startDate, data.endDate],
  );
  return getResponsibility(r.insertId);
}

async function updateResponsibility(id, patch) {
  const current = await getResponsibility(id);
  if (!current) return null;
  const projectId = patch.projectId !== undefined ? patch.projectId : current.projectId;
  const responsibilityType = patch.responsibilityType !== undefined ? patch.responsibilityType : current.responsibilityType;
  const startDate = patch.startDate !== undefined ? patch.startDate : current.startDate;
  const endDate = patch.endDate !== undefined ? patch.endDate : current.endDate;
  const overlaps = await checkOverlap(projectId, responsibilityType, startDate, endDate, id);
  if (overlaps.length > 0) {
    const conflict = overlaps[0];
    const err = new Error(`时间段与已有记录冲突（ID=${conflict.id}, ${conflict.start_date}~${conflict.end_date}）`);
    err.code = 'OVERLAP';
    err.conflict = conflict;
    throw err;
  }
  const map = {
    projectId: 'project_id', organizationId: 'organization_id',
    responsibilityType: 'responsibility_type', startDate: 'start_date', endDate: 'end_date',
  };
  const sets = [];
  const params = [];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) { sets.push(`${col} = ?`); params.push(patch[k]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP(3)');
    params.push(id);
    await pool.query(`UPDATE project_responsibilities SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  return getResponsibility(id);
}

async function deleteResponsibility(id) {
  const [r] = await pool.query('DELETE FROM project_responsibilities WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

async function getProjectResponsibilityAtDate(projectId, date) {
  const [rows] = await pool.query(
    `SELECT pr.*, o.name AS org_name, o.type AS org_type
     FROM project_responsibilities pr
     JOIN organizations o ON o.id = pr.organization_id
     WHERE pr.project_id = ? AND pr.start_date <= ? AND pr.end_date >= ?
     ORDER BY pr.responsibility_type, pr.start_date`,
    [projectId, date, date],
  );
  return rows.map((r) => ({
    ...mapResponsibility(r),
    orgName: r.org_name,
    orgType: r.org_type,
  }));
}

async function getProjectResponsibilityHistory(projectId) {
  const [rows] = await pool.query(
    `SELECT pr.*, o.name AS org_name, o.type AS org_type
     FROM project_responsibilities pr
     JOIN organizations o ON o.id = pr.organization_id
     WHERE pr.project_id = ?
     ORDER BY pr.responsibility_type, pr.start_date, pr.id`,
    [projectId],
  );
  return rows.map((r) => ({
    ...mapResponsibility(r),
    orgName: r.org_name,
    orgType: r.org_type,
  }));
}

/* ----------------------------- 责任落实看板 ----------------------------- */

async function getResponsibilityDashboard(daysBeforeExpiry) {
  const beforeDays = daysBeforeExpiry || 90;

  const [vacancyRows] = await pool.query(
    `SELECT p.id AS project_id, p.code, p.name, rt.resp_type
     FROM projects p
     CROSS JOIN (
       SELECT 'OWNER' AS resp_type
       UNION SELECT 'MAINTENANCE'
     ) rt
     WHERE NOT EXISTS (
       SELECT 1 FROM project_responsibilities pr
       WHERE pr.project_id = p.id
         AND pr.responsibility_type = rt.resp_type
         AND pr.start_date <= CURDATE()
         AND pr.end_date >= CURDATE()
     )
     ORDER BY p.id, rt.resp_type`,
  );

  const vacancyAlerts = vacancyRows.map((r) => ({
    projectId: r.project_id,
    projectCode: r.code,
    projectName: r.name,
    missingType: r.resp_type,
  }));

  const [mgrRows] = await pool.query(
    `SELECT o.id AS org_id, o.name AS org_name, COUNT(DISTINCT pr.project_id) AS project_count
     FROM organizations o
     JOIN project_responsibilities pr ON pr.organization_id = o.id
     WHERE o.type = 'MAINTENANCE'
       AND pr.responsibility_type = 'MAINTENANCE'
       AND pr.start_date <= CURDATE()
       AND pr.end_date >= CURDATE()
     GROUP BY o.id, o.name
     ORDER BY project_count DESC`,
  );

  const managerStats = mgrRows.map((r) => ({
    orgId: r.org_id,
    orgName: r.org_name,
    projectCount: r.project_count,
  }));

  const [expiryRows] = await pool.query(
    `SELECT pr.*, o.name AS org_name, p.code AS project_code, p.name AS project_name
     FROM project_responsibilities pr
     JOIN organizations o ON o.id = pr.organization_id
     JOIN projects p ON p.id = pr.project_id
     WHERE pr.end_date <> '9999-12-31'
       AND pr.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY pr.end_date, pr.id`,
    [beforeDays],
  );

  const expiryAlerts = expiryRows.map((r) => ({
    ...mapResponsibility(r),
    orgName: r.org_name,
    projectCode: r.project_code,
    projectName: r.project_name,
  }));

  return { vacancyAlerts, managerStats, expiryAlerts };
}

module.exports = {
  seed, isEmpty,
  findUserByUsername, getUser, listUsers, createUser,
  listProjects, getProject, findProjectByCode, createProject, updateProject, deleteProject,
  listEquipments, createEquipment,
  listInspections, createInspection,
  listOrganizations, getOrganization, findOrganizationByCreditCode, createOrganization, updateOrganization, deleteOrganization, getOrganizationProjects,
  listResponsibilities, getResponsibility, createResponsibility, updateResponsibility, deleteResponsibility,
  getProjectResponsibilityAtDate, getProjectResponsibilityHistory,
  getResponsibilityDashboard,
};
