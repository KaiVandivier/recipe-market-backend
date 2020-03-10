const { GraphQLServer } = require("graphql-yoga");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const Query = require("./resolvers/Query");
const Mutation = require("./resolvers/Mutation");
const db = require("./db");

const server = new GraphQLServer({
  typeDefs: "src/schema.graphql",
  resolvers: { Query, Mutation },
  resolverValidationOptions: {
    requireResolversForResolveType: false
  },
  context: req => ({ ...req, db })
})

// Middleware for cookies
server.express.use(cookieParser());

// Middleware to decode JWT from cookies to get logged-in user's ID
server.express.use(async (req, res, next) => {
  const { token } = req.cookies;
  if (token) {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.query.user({ where: { id: userId } }, `{ id, permissions, email, name }`);
    req.userId = userId;
    req.user = user;
  }
  next();
})

server.start({ cors: {
  credentials: true,
  origin: process.env.FRONTEND_URL,
}}, (details) => console.log(`--- Server is running on localhost:${details.port} ---`))
