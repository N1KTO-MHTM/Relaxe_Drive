import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/http-exception.filter';

const ts = Date.now();

function registerAndLogin(app: INestApplication, role: 'ADMIN' | 'DISPATCHER' | 'DRIVER') {
  const nickname = `e2e-${role.toLowerCase()}-${ts}`;
  return request(app.getHttpServer())
    .post('/auth/register')
    .send({ nickname, password: 'Test123!', role })
    .expect(201)
    .then(() =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ nickname, password: 'Test123!' })
        .expect(200)
        .then((loginRes) => ({
          token: (loginRes.body as { accessToken: string }).accessToken,
          userId: (loginRes.body as { user: { id: string } }).user.id,
        })),
    );
}

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: string;
  let dispatcherToken: string;
  let driverToken: string;
  let driverId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const [admin, dispatcher, driver] = await Promise.all([
      registerAndLogin(app, 'ADMIN'),
      registerAndLogin(app, 'DISPATCHER'),
      registerAndLogin(app, 'DRIVER'),
    ]);
    adminToken = admin.token;
    adminId = admin.userId;
    dispatcherToken = dispatcher.token;
    driverToken = driver.token;
    driverId = driver.userId;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Public endpoints', () => {
    it('GET /health returns status and services', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('services');
          expect(res.body.services).toHaveProperty('database');
        });
    });

    it('POST /auth/forgot-password accepts nickname', () => {
      return request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ nickname: 'someone' })
        .expect(200)
        .expect((res) => {
          expect(res.body.ok).toBe(true);
          expect(res.body.message).toBeDefined();
        });
    });

    it('POST /auth/reset-password rejects invalid token', () => {
      return request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'invalid', newPassword: 'newpass123' })
        .expect(401);
    });

    it('POST /auth/reset-password rejects short password', () => {
      return request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'invalid', newPassword: 'short' })
        .expect(401);
    });
  });

  describe('Role: ADMIN', () => {
    it('GET /audit returns array', () => {
      return request(app.getHttpServer())
        .get('/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true));
    });

    it('GET /audit?limit=5 returns at most 5', () => {
      return request(app.getHttpServer())
        .get('/audit?limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeLessThanOrEqual(5);
        });
    });

    it('GET /white-label returns config or null', () => {
      return request(app.getHttpServer())
        .get('/white-label')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          const body = res.body;
          expect(body === null || (typeof body === 'object')).toBe(true);
        });
    });

    it('GET /cost-control returns usage data', () => {
      return request(app.getHttpServer())
        .get('/cost-control')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('maps');
          expect(res.body).toHaveProperty('translation');
        });
    });

    it('GET /users returns list', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true));
    });

    it('GET /users/sessions returns sessions', () => {
      return request(app.getHttpServer())
        .get('/users/sessions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true));
    });

    it('POST /auth/admin/generate-reset-token returns token and link', () => {
      return request(app.getHttpServer())
        .post('/auth/admin/generate-reset-token')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: adminId })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('token');
          expect(res.body).toHaveProperty('link');
          expect(res.body.link).toContain('forgot-password');
          expect(res.body.link).toContain('token=');
        });
    });

    it('POST /auth/admin/generate-reset-token without auth returns 401', () => {
      return request(app.getHttpServer())
        .post('/auth/admin/generate-reset-token')
        .send({ userId: adminId })
        .expect(401);
    });
  });

  describe('Role: DISPATCHER', () => {
    it('GET /audit returns array', () => {
      return request(app.getHttpServer())
        .get('/audit')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true));
    });

    it('GET /users returns list', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true));
    });

    it('GET /users/sessions returns sessions', () => {
      return request(app.getHttpServer())
        .get('/users/sessions')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true));
    });

    it('GET /orders returns array', () => {
      return request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true));
    });

    it('GET /passengers returns array', () => {
      return request(app.getHttpServer())
        .get('/passengers')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true));
    });

    it('GET /analytics/stats returns data', () => {
      return request(app.getHttpServer())
        .get('/analytics/stats')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200)
        .expect((res) => expect(res.body).toBeDefined());
    });

    it('GET /white-label returns 403', () => {
      return request(app.getHttpServer())
        .get('/white-label')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(403);
    });

    it('GET /cost-control returns 403', () => {
      return request(app.getHttpServer())
        .get('/cost-control')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(403);
    });

    it('POST /auth/admin/generate-reset-token returns 403', () => {
      return request(app.getHttpServer())
        .post('/auth/admin/generate-reset-token')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .send({ userId: adminId })
        .expect(403);
    });
  });

  describe('Role: DRIVER', () => {
    it('GET /users/me returns own profile', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', driverId);
          expect(res.body).toHaveProperty('role', 'DRIVER');
          expect(res.body).toHaveProperty('available');
        });
    });

    it('GET /orders returns array (own only)', () => {
      return request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true));
    });

    it('PATCH /users/me/location updates location', () => {
      return request(app.getHttpServer())
        .patch('/users/me/location')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: 41.1, lng: -74.0 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('lat', 41.1);
          expect(res.body).toHaveProperty('lng', -74);
        });
    });

    it('PATCH /users/me/available updates available', () => {
      return request(app.getHttpServer())
        .patch('/users/me/available')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ available: false })
        .expect(200)
        .expect((res) => expect(res.body).toHaveProperty('available', false));
    });

    it('GET /reports with bounds returns array', () => {
      return request(app.getHttpServer())
        .get('/reports?minLat=40&maxLat=42&minLng=-75&maxLng=-73&sinceMinutes=60')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200)
        .expect((res) => expect(Array.isArray(res.body)).toBe(true));
    });

    it('GET /audit returns 403', () => {
      return request(app.getHttpServer())
        .get('/audit')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(403);
    });

    it('GET /users returns 403', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(403);
    });

    it('GET /users/sessions returns 403', () => {
      return request(app.getHttpServer())
        .get('/users/sessions')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(403);
    });

    it('GET /white-label returns 403', () => {
      return request(app.getHttpServer())
        .get('/white-label')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(403);
    });

    it('GET /passengers returns 403', () => {
      return request(app.getHttpServer())
        .get('/passengers')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(403);
    });

    it('GET /analytics/stats returns 403', () => {
      return request(app.getHttpServer())
        .get('/analytics/stats')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(403);
    });

    it('POST /auth/admin/generate-reset-token returns 403', () => {
      return request(app.getHttpServer())
        .post('/auth/admin/generate-reset-token')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ userId: adminId })
        .expect(403);
    });
  });

  describe('Functionality: Orders flow', () => {
    let orderId: string;

    it('dispatcher creates order', async () => {
      const pickupAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .send({
          pickupAt,
          pickupAddress: '123 Main St, Spring Valley NY',
          dropoffAddress: '456 Oak Ave, New York NY',
        })
        .expect(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('status', 'SCHEDULED');
      orderId = res.body.id;
    });

    it('dispatcher sees order in list', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((o: { id: string }) => o.id === orderId);
      expect(found).toBeDefined();
    });

    it('driver set available for assignment', async () => {
      await request(app.getHttpServer())
        .patch('/users/me/available')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ available: true })
        .expect(200);
    });

    it('dispatcher assigns driver to order', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/assign`)
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .send({ driverId })
        .expect(200);
      expect(res.body).toHaveProperty('driverId', driverId);
      expect(res.body).toHaveProperty('status', 'ASSIGNED');
    });

    it('driver sees assigned order in list', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);
      const found = res.body.find((o: { id: string }) => o.id === orderId);
      expect(found).toBeDefined();
      expect(found.status).toBe('ASSIGNED');
    });

    it('driver marks arrived at pickup', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/arrived-at-pickup`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('arrivedAtPickupAt');
    });

    it('driver sets status IN_PROGRESS', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);
      expect(res.body).toHaveProperty('status', 'IN_PROGRESS');
    });

    it('driver completes order', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ status: 'COMPLETED' })
        .expect(200);
      expect(res.body).toHaveProperty('deleted', true);
    });

    it('completed order not in active list for driver', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);
      const found = res.body.find((o: { id: string }) => o.id === orderId);
      expect(found).toBeUndefined();
    });
  });

  describe('Functionality: Order reject flow', () => {
    let rejectOrderId: string;

    it('dispatcher creates second order', async () => {
      const pickupAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .send({
          pickupAt,
          pickupAddress: '789 Test Rd',
          dropoffAddress: '999 End St',
        })
        .expect(201);
      rejectOrderId = res.body.id;
    });

    it('dispatcher assigns driver', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${rejectOrderId}/assign`)
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .send({ driverId })
        .expect(200);
    });

    it('driver rejects order', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${rejectOrderId}/reject`)
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('driverId', null);
      expect(res.body.status).not.toBe('ASSIGNED');
    });
  });

  describe('Functionality: Passengers', () => {
    let passengerId: string;

    it('dispatcher creates passenger', async () => {
      const res = await request(app.getHttpServer())
        .post('/passengers')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .send({ phone: `+7999${ts.toString().slice(-7)}`, name: 'E2E Passenger' })
        .expect(201);
      expect(res.body).toHaveProperty('id');
      passengerId = res.body.id;
    });

    it('dispatcher lists passengers and finds created', async () => {
      const res = await request(app.getHttpServer())
        .get('/passengers')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200);
      const found = res.body.find((p: { id: string }) => p.id === passengerId);
      expect(found).toBeDefined();
    });
  });

  describe('Functionality: Reports (driver)', () => {
    it('driver creates report', async () => {
      const res = await request(app.getHttpServer())
        .post('/reports')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ lat: 41.11, lng: -74.04, type: 'OTHER', description: 'E2E test report' })
        .expect(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('lat', 41.11);
      expect(res.body).toHaveProperty('lng', -74.04);
      expect(res.body).toHaveProperty('type', 'OTHER');
    });

    it('GET /reports in bounds returns array', async () => {
      const res = await request(app.getHttpServer())
        .get('/reports?minLat=41&maxLat=42&minLng=-75&maxLng=-73&sinceMinutes=120')
        .set('Authorization', `Bearer ${driverToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Functionality: Order route (maps)', () => {
    let routeOrderId: string;

    it('create order for route', async () => {
      const pickupAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .send({
          pickupAt,
          pickupAddress: 'Spring Valley NY',
          dropoffAddress: 'New York NY',
        })
        .expect(201);
      routeOrderId = res.body.id;
    });

    it('GET /orders/:id/route returns route shape', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${routeOrderId}/route`)
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('pickupCoords');
      expect(res.body).toHaveProperty('dropoffCoords');
      expect(res.body).toHaveProperty('polyline');
      expect(res.body).toHaveProperty('durationMinutes');
      expect(res.body).toHaveProperty('distanceKm');
    });
  });

  describe('Functionality: Order delete', () => {
    let deleteOrderId: string;

    it('dispatcher creates draft order', async () => {
      const pickupAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .send({
          pickupAt,
          pickupAddress: 'To Delete St',
          dropoffAddress: 'Nowhere',
        })
        .expect(201);
      deleteOrderId = res.body.id;
    });

    it('dispatcher deletes order', async () => {
      await request(app.getHttpServer())
        .delete(`/orders/${deleteOrderId}`)
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200);
    });

    it('order no longer in list', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${dispatcherToken}`)
        .expect(200);
      const found = res.body.find((o: { id: string }) => o.id === deleteOrderId);
      expect(found).toBeUndefined();
    });
  });

  describe('Functionality: Admin user management', () => {
    it('admin changes driver role to DISPATCHER', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/users/${driverId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'DISPATCHER' })
        .expect(200);
      expect(res.body).toHaveProperty('role', 'DISPATCHER');
    });

    it('admin changes back to DRIVER', async () => {
      await request(app.getHttpServer())
        .patch(`/users/${driverId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'DRIVER' })
        .expect(200);
    });
  });
});
