import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import stocksRouter from './routes/stocks.js';
import positionsRouter from './routes/positions.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/stocks', stocksRouter);
app.use('/api/positions', positionsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
