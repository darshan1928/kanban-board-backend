const request = require("supertest");
const app = require("../src/app");
const { setupTestDB, teardownTestDB, clearCollections } = require("./setup");

process.env.JWT_SECRET = "test-secret";

beforeAll(setupTestDB);
afterAll(teardownTestDB);
afterEach(clearCollections);

const validUser = {
  name: "Jordan Blake",
  username: "jordan_b",
  email: "jordan@example.com",
  password: "Str0ng!Pass",
};

describe("POST /api/auth/signup", () => {
  test("creates a user and never returns the password hash", async () => {
    const res = await request(app).post("/api/auth/signup").send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.data.username).toBe("jordan_b");
    expect(res.body.data.passwordHash).toBeUndefined();
  });

  test("rejects a duplicate email with EMAIL_TAKEN", async () => {
    await request(app).post("/api/auth/signup").send(validUser);
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validUser, username: "someoneelse" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  test("rejects a duplicate username with USERNAME_TAKEN", async () => {
    await request(app).post("/api/auth/signup").send(validUser);
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validUser, email: "different@example.com" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("USERNAME_TAKEN");
  });

  test("rejects a weak password", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validUser, password: "weak" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects a username starting with a digit", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validUser, username: "1jordan" });
    expect(res.status).toBe(400);
  });

  test("rejects a malformed email", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...validUser, email: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/signup").send(validUser);
  });

  test("logs in with username + password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "jordan_b", password: "Str0ng!Pass" });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  test("logs in with email instead of username", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "jordan@example.com", password: "Str0ng!Pass" });
    expect(res.status).toBe(200);
  });

  test("rejects a wrong password with a generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "jordan_b", password: "WrongPass1!" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("rejects a login for a username that doesn't exist, same generic message", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "nobody_here", password: "Str0ng!Pass" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("GET /api/auth/session", () => {
  test("rejects when no token is provided", async () => {
    const res = await request(app).get("/api/auth/session");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("NO_SESSION");
  });

  test("rejects a garbage token", async () => {
    const res = await request(app).get("/api/auth/session").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SESSION_EXPIRED");
  });

  test("returns the user for a valid token", async () => {
    await request(app).post("/api/auth/signup").send(validUser);
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "jordan_b", password: "Str0ng!Pass" });
    const token = loginRes.body.data.token;

    const res = await request(app).get("/api/auth/session").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe("jordan_b");
  });
});
