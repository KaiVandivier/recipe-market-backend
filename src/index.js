const { GraphQLServer } = require("graphql-yoga");
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

server.start({ cors: {
  credentials: true,
  origin: process.env.FRONTEND_URL,
}}, (details) => console.log(`--- Server is running on localhost:${details.port} ---`))
