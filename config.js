module.exports = {
  urls: [
    {
      name: 'Ilha dos Caiçaras',
      url: 'https://www.quintoandar.com.br/alugar/imovel/ilha-dos-caicaras-lagoa-rio-de-janeiro-rj-brasil/de-500-a-8500-reais/apartamento/kitnet/1-quartos',
      threshold: 1
    },
    {
      name: 'Leblon',
      url: 'https://www.quintoandar.com.br/alugar/imovel/leblon-rio-de-janeiro-rj-brasil/de-500-a-8500-reais/apartamento/kitnet/1-quartos',
      threshold: 1   // 👈 alerte à partir de 2 annonces
    },
    {
      name: 'Rua Dias Ferreira 417 - Leblon',
      url: 'https://www.quintoandar.com.br/alugar/imovel/rua-dias-ferreira-417-leblon-rio-de-janeiro-rj-brasil/de-500-a-3500-reais/apartamento/kitnet/1-quartos',
      threshold: 1
    }
  ]
};
