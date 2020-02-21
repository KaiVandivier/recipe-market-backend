const { Prisma } = require("prisma-binding");

const db = new Prisma({
  typeDefs: "src/generated/prisma.graphql",
  endpoint: "https://us1.prisma.sh/kpvandivier-c3a1aa/recipe-market-backend/dev"
});

// Todo: add secret and access endpoint from environmental variables

module.exports = db;
