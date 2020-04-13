const { GraphQLServer } = require("graphql-yoga");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const Query = require("./resolvers/Query");
const Mutation = require("./resolvers/Mutation");
const db = require("./db");
const { handleCheckoutSessionCompleted } = require("./webhookHandlers");

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
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    const user = await db.query.user({ where: { id: userId } }, `{ id, permissions, email, name }`);
    req.userId = userId;
    req.user = user;
  }
  next();
});

// Endpoint to catch webhooks (notice `post`)
// Note: the boilerplate from the Stripe docs use `bodyParser.raw()`,
// and my own testing shows `bodyParser.json()` works too with one less step (omitting the later `JSON.parse()` step)
// I'm not sure why `raw` is used, but maybe it's relevant
server.express.post("/webhooks", bodyParser.raw({ type: "application/json" }), async (req, res, next) => {
  let event;
  try {
    event = JSON.parse(req.body);
  } catch (err) {
    res.status(400).send(`Webhook error: ${err.message}`)
  }
  
  // handle webhook here
  switch (event.type) {
    case "checkout.session.completed":
      const checkoutSession = event.data.object;
      handleCheckoutSessionCompleted(checkoutSession, db);
      break;
    default:
      // unexpected event type
      return res.status(400).end();
  }

  res.status(200).send();
})

server.start({ cors: {
  credentials: true,
  origin: process.env.FRONTEND_URL,
}}, (details) => console.log(`--- Server is running on localhost:${details.port} ---`))
