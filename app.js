const cluster = require('cluster');
const redis = require('redis');
const numCPUs = require('os').cpus().length;

const setupGenerator = () => {
    const workers = Object.values(cluster.workers).map(x => x.id)
    const generator = workers[Math.floor(Math.random() * workers.length)];

    return { workers, generator }
};

const setupMaster = () => {
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    const { workers, generator } = setupGenerator()

    cluster.on('online', (worker) => {
        if (worker.id === generator) {
            console.log(`>> Current generator: instance #${generator}`)
        }

        worker.send({ workers, generator });
    });

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Instance #${worker.id}, process: ${worker.process.pid} - EXIT!`);

        const { workers, generator } = setupGenerator()

        for (const id in cluster.workers) {
            if (+id === generator) {
                console.log(`New generator: instance #${generator}`)
            }

            cluster.workers[id].send({ workers, generator });
        }
    });
};

const setupWorker = () => {
    const subscriber = redis.createClient({ host: 'redis' });
    const publisher = redis.createClient({ host: 'redis' });

    subscriber.subscribe(`notification-${cluster.worker.id}`);

    subscriber.on('message', function (channel, message) {
        console.log(`>> This message from instance #${message} to instance #${cluster.worker.id}`);
    });

    let interval = null

    process.on('message', ({ workers, generator }) => {
        if (interval) clearInterval(interval)

        if (generator === cluster.worker.id) {
            interval = setInterval(() => {
                workers = workers.filter(x => x !== cluster.worker.id)

                if (workers.length) {
                    const rand = workers[Math.floor(Math.random() * workers.length)];

                    publisher.publish(`notification-${rand}`, cluster.worker.id);
                } else {
                    clearInterval(interval)
                }
            }, 1000)
        }
    });
};

if (cluster.isMaster) {
    setupMaster()
    console.log(`Master started, process: ${process.pid}`);
} else {
    setupWorker()
    console.log(`Instance #${cluster.worker.id} started, process: ${process.pid}`);
}
