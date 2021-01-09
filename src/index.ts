import app from './app';

const PORT = process.env.PORT;

async function init() {
  app.listen(4000, () => {
    console.log(`app is running on port ${PORT}`);
  });
}

init();
