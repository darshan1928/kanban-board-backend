const request = require("supertest");
const app = require("../src/app");
const { setupTestDB, teardownTestDB, clearCollections } = require("./setup");

process.env.JWT_SECRET = "test-secret";

beforeAll(setupTestDB);
afterAll(teardownTestDB);
afterEach(clearCollections);

async function signupAndLogin(overrides = {}) {
  const user = {
    name: "Jordan Blake",
    username: "jordan_b",
    email: "jordan@example.com",
    password: "Str0ng!Pass",
    ...overrides,
  };
  await request(app).post("/api/auth/signup").send(user);
  const res = await request(app)
    .post("/api/auth/login")
    .send({ identifier: user.username, password: user.password });
  return res.body.data.token;
}

const taskPayload = { name: "Write release notes", priority: "high", deadline: "2026-10-01" };

describe("task routes require auth", () => {
  test("GET /api/tasks without a token is rejected", async () => {
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(401);
  });

  test("POST /api/tasks without a token is rejected", async () => {
    const res = await request(app).post("/api/tasks").send(taskPayload);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/tasks", () => {
  test("creates a task in the Backlog stage by default", async () => {
    const token = await signupAndLogin();
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send(taskPayload);
    expect(res.status).toBe(201);
    expect(res.body.data.stage).toBe(0);
  });

  test("rejects a missing name", async () => {
    const token = await signupAndLogin();
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...taskPayload, name: "" });
    expect(res.status).toBe(400);
  });

  test("rejects an invalid priority", async () => {
    const token = await signupAndLogin();
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...taskPayload, priority: "urgent" });
    expect(res.status).toBe(400);
  });

  test("rejects a duplicate task name for the same user (case-insensitive)", async () => {
    const token = await signupAndLogin();
    await request(app).post("/api/tasks").set("Authorization", `Bearer ${token}`).send(taskPayload);
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...taskPayload, name: "WRITE RELEASE NOTES" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TASK_NAME_DUPLICATE");
  });

  test("allows two different users to use the same task name", async () => {
    const tokenA = await signupAndLogin({ username: "user_a", email: "a@example.com" });
    const tokenB = await signupAndLogin({ username: "user_b", email: "b@example.com" });

    const resA = await request(app).post("/api/tasks").set("Authorization", `Bearer ${tokenA}`).send(taskPayload);
    const resB = await request(app).post("/api/tasks").set("Authorization", `Bearer ${tokenB}`).send(taskPayload);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
  });
});

describe("GET /api/tasks", () => {
  test("only returns the logged-in user's own tasks", async () => {
    const tokenA = await signupAndLogin({ username: "user_a", email: "a@example.com" });
    const tokenB = await signupAndLogin({ username: "user_b", email: "b@example.com" });

    await request(app).post("/api/tasks").set("Authorization", `Bearer ${tokenA}`).send(taskPayload);
    await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ ...taskPayload, name: "A completely different task" });

    const res = await request(app).get("/api/tasks").set("Authorization", `Bearer ${tokenA}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe(taskPayload.name);
  });
});

describe("PUT/PATCH /api/tasks/:id", () => {
  test("updates name, priority and deadline", async () => {
    const token = await signupAndLogin();
    const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${token}`).send(taskPayload);

    const res = await request(app)
      .put(`/api/tasks/${created.body.data._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Renamed task", priority: "low", deadline: "2026-11-01" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Renamed task");
    expect(res.body.data.priority).toBe("low");
  });

  test("moving stage via PATCH works and stays within 0-3", async () => {
    const token = await signupAndLogin();
    const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${token}`).send(taskPayload);

    const res = await request(app)
      .patch(`/api/tasks/${created.body.data._id}/stage`)
      .set("Authorization", `Bearer ${token}`)
      .send({ stage: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.stage).toBe(2);
  });

  test("rejects a stage outside 0-3", async () => {
    const token = await signupAndLogin();
    const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${token}`).send(taskPayload);

    const res = await request(app)
      .patch(`/api/tasks/${created.body.data._id}/stage`)
      .set("Authorization", `Bearer ${token}`)
      .send({ stage: 9 });
    expect(res.status).toBe(400);
  });

  test("renaming to a name that collides with another of the user's tasks is rejected", async () => {
    const token = await signupAndLogin();
    await request(app).post("/api/tasks").set("Authorization", `Bearer ${token}`).send(taskPayload);
    const second = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...taskPayload, name: "Second task" });

    const res = await request(app)
      .put(`/api/tasks/${second.body.data._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: taskPayload.name });
    expect(res.status).toBe(409);
  });

  test("404s on a task that doesn't exist", async () => {
    const token = await signupAndLogin();
    const res = await request(app)
      .put("/api/tasks/64a000000000000000000000")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "doesn't matter" });
    expect(res.status).toBe(404);
  });

  test("404s (not 403) when trying to edit someone else's task, so ids can't be probed", async () => {
    const tokenA = await signupAndLogin({ username: "user_a", email: "a@example.com" });
    const tokenB = await signupAndLogin({ username: "user_b", email: "b@example.com" });
    const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${tokenA}`).send(taskPayload);

    const res = await request(app)
      .put(`/api/tasks/${created.body.data._id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "hijacked" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/tasks/:id", () => {
  test("deletes a task the user owns", async () => {
    const token = await signupAndLogin();
    const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${token}`).send(taskPayload);

    const res = await request(app).delete(`/api/tasks/${created.body.data._id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const list = await request(app).get("/api/tasks").set("Authorization", `Bearer ${token}`);
    expect(list.body.data).toHaveLength(0);
  });

  test("404s deleting a task that doesn't belong to the caller", async () => {
    const tokenA = await signupAndLogin({ username: "user_a", email: "a@example.com" });
    const tokenB = await signupAndLogin({ username: "user_b", email: "b@example.com" });
    const created = await request(app).post("/api/tasks").set("Authorization", `Bearer ${tokenA}`).send(taskPayload);

    const res = await request(app)
      .delete(`/api/tasks/${created.body.data._id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });
});
