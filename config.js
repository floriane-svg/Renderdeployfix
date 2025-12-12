module.exports = {
  urls: [
    {
      name: 'Ilha dos Caiçaras',
      url: 'https://www.quintoandar.com.br/alugar/imovel/ilha-dos-caicaras-lagoa-rio-de-janeiro-rj-brasil/de-500-a-3500-reais/apartamento/kitnet/1-quartos',
      threshold: 1
    },
    {
      name: 'Leblon',
      url: 'https://www.quintoandar.com.br/alugar/imovel/leblon-rio-de-janeiro-rj-brasil/de-500-a-3500-reais/apartamento/kitnet/1-quartos',
      threshold: 5
    },
    {
      name: 'Rua Dias Ferreira 417 - Leblon',
      url: 'https://www.quintoandar.com.br/alugar/imovel/rua-dias-ferreira-417-leblon-rio-de-janeiro-rj-brasil/de-500-a-3500-reais/apartamento/kitnet/1-quartos',
      threshold: 5
    }
  ],

  keyword: 'Cozy__CardRow-Container',

  monitoring: {
    maxRetries: 3,
    retryDelays: [2000, 3000, 5000],
    pageTimeout: 30000,
    waitAfterLoad: 3000
  },

  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ]
};

