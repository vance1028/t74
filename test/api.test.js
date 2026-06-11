'use strict';

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const { createApp } = require('../src/app');
const { waitForDb, close } = require('../src/db');
const store = require('../src/data/store');

const app = createApp();

async function login(username, password) {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res;
}

async function tokenOf(username, password) {
  const res = await login(username, password);
  return res.body.data.token;
}

before(async () => {
  await waitForDb();
});

beforeEach(async () => {
  await store.seed();
});

after(async () => {
  await close();
});

test('GET /api/health 返回 ok', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
});

/* ---------- 登录 ---------- */

test('登录成功返回 token 和用户信息', async () => {
  const res = await login('admin', 'admin123');
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.token);
  assert.strictEqual(res.body.data.user.role, 'ADMIN');
});

test('密码错误返回 401', async () => {
  const res = await login('admin', 'wrongpass');
  assert.strictEqual(res.status, 401);
});

test('用户名不存在返回 401', async () => {
  const res = await login('nobody', 'x');
  assert.strictEqual(res.status, 401);
});

test('空用户名/密码返回 400', async () => {
  const res = await login('', '');
  assert.strictEqual(res.status, 400);
});

test('GET /api/auth/me 带 token 返回当前用户', async () => {
  const token = await tokenOf('manager', 'manager123');
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.username, 'manager');
});

/* ---------- 鉴权拦截 ---------- */

test('未带 token 访问工程列表返回 401', async () => {
  const res = await request(app).get('/api/projects');
  assert.strictEqual(res.status, 401);
});

test('无效 token 返回 401', async () => {
  const res = await request(app).get('/api/projects').set('Authorization', 'Bearer not.a.token');
  assert.strictEqual(res.status, 401);
});

/* ---------- 工程查询 ---------- */

test('登录后能列出种子工程', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.total, 4);
});

test('工程列表支持按状态筛选', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/projects?status=MAINTENANCE').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.every((p) => p.status === 'MAINTENANCE'));
});

test('工程列表支持关键词搜索', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/projects?keyword=滨江').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 1);
});

test('工程详情含设备子资源接口', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/projects/1/equipments').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.length >= 1);
});

/* ---------- 角色权限 ---------- */

test('管理员能新建工程', async () => {
  const token = await tokenOf('admin', 'admin123');
  const res = await request(app).post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: 'RF-NEW-1', name: '新增测试工程', district: '城关区' });
  assert.strictEqual(res.status, 201);
});

test('巡检员新建工程被拒 403', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: 'RF-NEW-2', name: 'x' });
  assert.strictEqual(res.status, 403);
});

test('工程编号重复返回 409', async () => {
  const token = await tokenOf('admin', 'admin123');
  const res = await request(app).post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: 'RF-2024-001', name: '重复编号' });
  assert.strictEqual(res.status, 409);
});

test('仅管理员能删除工程；管理员删除成功 204', async () => {
  const mgr = await tokenOf('manager', 'manager123');
  const denied = await request(app).delete('/api/projects/4').set('Authorization', `Bearer ${mgr}`);
  assert.strictEqual(denied.status, 403);

  const admin = await tokenOf('admin', 'admin123');
  const ok = await request(app).delete('/api/projects/4').set('Authorization', `Bearer ${admin}`);
  assert.strictEqual(ok.status, 204);
});

/* ---------- 检查记录 ---------- */

test('巡检员能登记检查记录', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).post('/api/inspections')
    .set('Authorization', `Bearer ${token}`)
    .send({ projectId: 1, inspectDate: '2026-06-05', type: 'ROUTINE', result: 'PASS' });
  assert.strictEqual(res.status, 201);
});

test('检查记录非法日期返回 400', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).post('/api/inspections')
    .set('Authorization', `Bearer ${token}`)
    .send({ projectId: 1, inspectDate: '2026/6/5' });
  assert.strictEqual(res.status, 400);
});

test('检查记录可按工程筛选', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/inspections?projectId=1').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.every((i) => i.projectId === 1));
});

test('未知接口返回 404', async () => {
  const res = await request(app).get('/api/unknown');
  assert.strictEqual(res.status, 404);
});

/* ---------- 单位档案 ---------- */

test('管理员能新建单位', async () => {
  const token = await tokenOf('admin', 'admin123');
  const res = await request(app).post('/api/organizations')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '测试单位', type: 'OWNER', creditCode: 'TESTCODE001', contactPerson: '张三', contactPhone: '13800000001' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.name, '测试单位');
  assert.strictEqual(res.body.data.type, 'OWNER');
});

test('单位名称不能为空', async () => {
  const token = await tokenOf('admin', 'admin123');
  const res = await request(app).post('/api/organizations')
    .set('Authorization', `Bearer ${token}`)
    .send({ type: 'OWNER' });
  assert.strictEqual(res.status, 400);
});

test('信用代码重复返回 409', async () => {
  const token = await tokenOf('admin', 'admin123');
  const res = await request(app).post('/api/organizations')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '重复单位', creditCode: '91330100MA2ABC1D2E' });
  assert.strictEqual(res.status, 409);
});

test('列表能按类型筛选单位', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/organizations?type=OWNER').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.every((o) => o.type === 'OWNER'));
});

test('能获取单位详情', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/organizations/1').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.name, '城投置业有限公司');
});

test('能查询单位名下的工程', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/organizations/1/projects').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.length >= 1);
});

test('巡检员不能新建单位', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).post('/api/organizations')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'x' });
  assert.strictEqual(res.status, 403);
});

/* ---------- 责任关系 ---------- */

test('管理员能新建责任关系', async () => {
  const token = await tokenOf('admin', 'admin123');
  const res = await request(app).post('/api/responsibilities')
    .set('Authorization', `Bearer ${token}`)
    .send({ projectId: 3, organizationId: 2, responsibilityType: 'MAINTENANCE', startDate: '2026-07-01', endDate: '9999-12-31' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.projectId, 3);
  assert.strictEqual(res.body.data.organizationId, 2);
  assert.strictEqual(res.body.data.responsibilityType, 'MAINTENANCE');
});

test('时间段重叠返回 409', async () => {
  const token = await tokenOf('admin', 'admin123');
  const res = await request(app).post('/api/responsibilities')
    .set('Authorization', `Bearer ${token}`)
    .send({ projectId: 1, organizationId: 1, responsibilityType: 'OWNER', startDate: '2020-01-01', endDate: '9999-12-31' });
  assert.strictEqual(res.status, 409);
});

test('不重叠的时间段可以新增', async () => {
  const token = await tokenOf('admin', 'admin123');
  const res = await request(app).post('/api/responsibilities')
    .set('Authorization', `Bearer ${token}`)
    .send({ projectId: 1, organizationId: 4, responsibilityType: 'USER', startDate: '2018-09-01', endDate: '2019-02-28' });
  assert.strictEqual(res.status, 201);
});

test('起始日期晚于截止日期返回 400', async () => {
  const token = await tokenOf('admin', 'admin123');
  const res = await request(app).post('/api/responsibilities')
    .set('Authorization', `Bearer ${token}`)
    .send({ projectId: 3, organizationId: 2, responsibilityType: 'MAINTENANCE', startDate: '2026-07-01', endDate: '2026-06-01' });
  assert.strictEqual(res.status, 400);
});

test('能列出责任关系并按工程筛选', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/responsibilities?projectId=1').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.every((r) => r.projectId === 1));
  assert.strictEqual(res.body.data.length, 5);
});

test('能获取责任关系详情', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/responsibilities/1').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.orgName, '城投置业有限公司');
});

/* ---------- 时间点查询 ---------- */

test('查询工程在某日期的责任方', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/projects/1/responsibilities/at?date=2024-06-01').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  const owners = res.body.data.filter((r) => r.responsibilityType === 'OWNER');
  const maints = res.body.data.filter((r) => r.responsibilityType === 'MAINTENANCE');
  assert.strictEqual(owners.length, 1);
  assert.strictEqual(owners[0].orgName, '城投置业有限公司');
  assert.strictEqual(maints.length, 1);
  assert.strictEqual(maints[0].orgName, '恒泰物业管理有限公司');
});

test('时间点查询——物业变更后查新物业', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/projects/1/responsibilities/at?date=2025-06-01').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  const maints = res.body.data.filter((r) => r.responsibilityType === 'MAINTENANCE');
  assert.strictEqual(maints.length, 1);
  assert.strictEqual(maints[0].orgName, '华润万象生活有限公司');
});

test('工程完整责任变更历史', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/projects/1/responsibilities/history').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 5);
  const maints = res.body.data.filter((r) => r.responsibilityType === 'MAINTENANCE');
  assert.strictEqual(maints.length, 2);
});

test('产权转让历史查询', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const atOld = await request(app).get('/api/projects/2/responsibilities/at?date=2022-01-01').set('Authorization', `Bearer ${token}`);
  const ownersOld = atOld.body.data.filter((r) => r.responsibilityType === 'OWNER');
  assert.strictEqual(ownersOld[0].orgName, '城投置业有限公司');
  const atNew = await request(app).get('/api/projects/2/responsibilities/at?date=2024-01-01').set('Authorization', `Bearer ${token}`);
  const ownersNew = atNew.body.data.filter((r) => r.responsibilityType === 'OWNER');
  assert.strictEqual(ownersNew[0].orgName, '龙湖地产开发有限公司');
});

/* ---------- 责任落实看板 ---------- */

test('看板返回责任真空预警', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/responsibilities/dashboard').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.data.vacancyAlerts));
  assert.ok(Array.isArray(res.body.data.managerStats));
  assert.ok(Array.isArray(res.body.data.expiryAlerts));
  const proj3Alerts = res.body.data.vacancyAlerts.filter((a) => a.projectId === 3);
  assert.ok(proj3Alerts.some((a) => a.missingType === 'MAINTENANCE'));
});

test('看板返回物业管理工程统计', async () => {
  const token = await tokenOf('inspector', 'inspect123');
  const res = await request(app).get('/api/responsibilities/dashboard').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.managerStats.length >= 1);
  const hengtai = res.body.data.managerStats.find((m) => m.orgName === '恒泰物业管理有限公司');
  assert.ok(hengtai);
  assert.strictEqual(hengtai.projectCount, 1);
});
