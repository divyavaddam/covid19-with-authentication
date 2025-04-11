const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "shdfgfubdbvdjd", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUser = `
    SELECT * FROM user WHERE username = '${username}';
  `;
  const user = await db.get(getUser);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (isPasswordMatched) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "shdfgfubdbvdjd");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStates = `
      SELECT state_id AS stateId, state_name AS stateName, population FROM state
      ORDER BY state_id;
    `;
  const states = await db.all(getStates);
  response.send(states);
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getState = `
      SELECT state_id AS stateId, state_name AS stateName, population FROM state
      WHERE state_id = ${stateId};
    `;
  const state = await db.get(getState);
  response.send(state);
});

// API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrict = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});
  `;
  await db.run(createDistrict);
  response.send("District Successfully Added");
});

// API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `
      SELECT district_id AS districtId, district_name AS districtName,state_id AS stateId, cases, cured, active, deaths FROM district
      WHERE district_id = ${districtId};
    `;
    const district = await db.get(getDistrict);
    response.send(district);
  }
);

// API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
       DELETE FROM district 
       WHERE district_id = ${districtId};
     `;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);

// API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const { districtName, stateId, cases, cured, active, death } = request.body;
    const updateDistrict = `
      UPDATE district 
      SET 
        district_name = '${districtName}',
        state_id = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        death = ${death}
      WHERE district_id = ${districtId};
    `;
    await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);

// API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getstats = `
      SELECT SUM(district.cases) AS totalCases, SUM(district.cured) AS totalCured, SUM(district.active) AS totalActive, SUM(district.deaths) AS totalDeaths
      FROM district INNER JOIN state 
      ON district.state_id = state.state_id
      WHERE state.state_id = ${stateId};
    `;
    const state = await db.get(getstats);
    response.send(state);
  }
);

module.exports = app;
