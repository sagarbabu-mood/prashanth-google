const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "simplenotes.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
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
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid Access Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//Register API

app.post("/users/", async (request, response) => {
  const { username, email, password, location } = request.body;
  const selectUserQuery = `
    SELECT 
      * 
    FROM 
      Users 
    WHERE 
      username = "${username}"`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password using hash method
    const createUserQuery = `
        INSERT INTO 
        Users (username, email, password, location)
        VALUES 
        (
          "${username}",
          "${email}",
          "${hashedPassword}",
          "${location}"
        )
    `;
    await db.run(createUserQuery);
    response.send("User Created Successfully");
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//Login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM Users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password); // Compare User details using compare method
    console.log(`Password matched: ${isPasswordMatched}`); // Added debugging statement

    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// Get Profile API

app.get("/profile/", authenticateToken, async (request, response) => {
  let { username } = request;
  console.log(username);
  const selectUserQuery = `
  SELECT 
  * 
  FROM 
  Users 
  WHERE username = "${username}"
  ;`;
  const dbUser = await db.get(selectUserQuery);
  response.send(dbUser);
});

// Get Notes API

app.get("/notes/", authenticateToken, async (request, response) => {
  const getNotesQuery = `
                   SELECT 
                        * 
                    FROM 
                    Notes
                    ORDER BY 
                    user_id
                    ;`;
  const noteQuery = await db.all(getNotesQuery);
  response.send(noteQuery);
});

//Get Note API

app.get("/notes/:id/", authenticateToken, async (request, response) => {
  const { noteId } = request.params;
  const getNoteQuery = `
  SELECT * FROM Notes WHERE id = ${id};
  `;
  const dbQuery = await db.get(getNoteQuery);
  response.send(dbQuery);
});

//Add Note API

app.post("/notes", authenticateToken, async (request, response) => {
  const noteDetails = request.body;
  const { userId, title, content, tags, backgroundColor } = noteDetails;
  const createNoteQuery = `
  INSERT INTO 
  Notes(user_id, title, content, tags, background_color) 
  VALUES 
  (
      "${userId}",
      "${title}",
      "${content}",
      "${tags}",
      "${backgroundColor}"
  );
  `;
  const dbResponse = await db.run(createNoteQuery);
  response.send("Note Created Successfully");
});

//Update Note API

app.put("/notes/:id", authenticateToken, async (request, response) => {
  const { id } = request.params;
  const noteDetails = request.body;
  const { title, content, tags, backgroundColor } = noteDetails;
  const updateNoteQuery = `
    UPDATE 
    Notes 
    SET 
    title='${title}',
    content='${content}',
    tags='${tags}',
    background_color='${backgroundColor}' 
    WHERE 
    id = '${id}';
    `;
  await db.run(updateNoteQuery);
  response.send("Note Updated Successfully");
});

//Delete Note API

app.delete("/notes/:id/", authenticateToken, async (request, response) => {
  const { id } = request.params;
  const deleteNoteQuery = `
    DELETE FROM 
    Notes 
    WHERE 
    id = ${id};
    `;
  await db.run(deleteNoteQuery);
  response.send("Note Deleted Successfully");
});
