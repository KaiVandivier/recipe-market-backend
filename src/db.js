const { Prisma } = require("prisma-binding");

const db = new Prisma({
  typeDefs: "src/generated/prisma.graphql",
  endpoint: process.env.PRISMA_ENDPOINT
});

// Todo: add secret and 
// DONE: access endpoint from environmental variables

module.exports = db;
