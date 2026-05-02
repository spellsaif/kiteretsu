const pluginName = 'plugin';
const load = async () => {
  const mod = await import(`./${pluginName}`);
  mod.run();
};
