import app from './app';

const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

async function init() {
  app.listen(4000, HOST, () => {
    console.log(`app is running on port ${PORT}, host ${HOST}`);
  });
}

init();
