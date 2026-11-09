import express from "express";
import subjectsRouter from "./routes/subjects";
import cors from "cors";
const app = express();
const port = 8000;

if(!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Allow requests from the frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
  credentials: true, // Allow cookies to be sent with requests
}));

app.use(express.json());
app.use('/api/subjects', subjectsRouter);

app.get("/", (req, res) => {
  res.json({
    message: "Classroom API is running.",
  });
});

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});