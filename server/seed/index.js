require('dotenv').config();
const { runSeed } = require('./seedData');

const force = process.argv.includes('--force');
runSeed({ force });
