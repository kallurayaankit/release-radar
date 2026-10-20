import {runStress} from '../dist/stress-core.js';
const result=runStress({seed:Number(process.env.TEST_SEED||20261020),count:20000});
console.log(JSON.stringify(result,null,2));
if(result.verdict!=='passed')process.exitCode=1;
