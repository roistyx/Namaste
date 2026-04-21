import 'dotenv/config';
import fs from 'fs';
import https from 'https';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import stocksRouter    from './routes/stocks.js';
import positionsRouter from './routes/positions.js';
import schwabRouter    from './routes/schwab.js';
import accountsRouter  from './routes/accounts.js';
import fidelityRouter  from './routes/fidelity.js';
import stashRouter     from './routes/stash.js';
import apexRouter      from './routes/apex.js';
import sectorsRouter   from './routes/sectors.js';
import alertsRouter    from './volume-alert/api/routes/alerts.js';
import vaVolumeRouter  from './volume-alert/api/routes/volume.js';
import vaChartRouter   from './volume-alert/api/routes/chart.js';
import { startPollJob }       from './volume-alert/jobs/pollJob.js';
import { startOhlcvJob }      from './volume-alert/jobs/ohlcvJob.js';
import { startOutcomeJob }    from './volume-alert/jobs/outcomeJob.js';
import { startTrainerJob }    from './volume-alert/jobs/trainerJob.js';
import { startTickerSyncJob } from './volume-alert/jobs/tickerSyncJob.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.text({ limit: '5mb' }));

app.use('/api/stocks',    stocksRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/schwab',    schwabRouter);
app.use('/api/fidelity',  fidelityRouter);
app.use('/api/stash',     stashRouter);
app.use('/api/apex',      apexRouter);
app.use('/api/sectors',   sectorsRouter);
app.use('/api/alerts',    alertsRouter);
app.use('/api/volume',    vaVolumeRouter);
app.use('/api/chart',     vaChartRouter);
app.use('/api',           accountsRouter);


const ssl = {
  key:  fs.readFileSync(new URL('./127.0.0.1-key.pem', import.meta.url)),
  cert: fs.readFileSync(new URL('./127.0.0.1.pem',     import.meta.url)),
};

connectDB()
  .then(async () => {
    await startTickerSyncJob(); // runs sync on startup, then schedules daily
    startPollJob();
    startOhlcvJob();
    startOutcomeJob();
    startTrainerJob();
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
  });

https.createServer(ssl, app).listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on https://127.0.0.1:${PORT}`);
});
