// Add new lab papers here; each overview has its own route.
export const papers = [
  {
    slug: 'eigenbench',
    title: 'EigenBench',
    subtitle: 'A Comparative Behavioral Measure of Value Alignment',
    description: 'Models answer the same scenarios and judge each other’s answers against a written set of values.',
    image: '/assets/art/model-conversation.webp',
    paper: 'https://arxiv.org/abs/2509.01938',
  },
  {
    slug: 'character-training',
    title: 'Side Effects of Character Training',
    subtitle: 'Quantifying Cross-Constitution Drift in LLMs',
    description: 'Training a model on one trait shifts others too. We measure those side effects and what it costs to reduce them.',
    image: '/assets/art/character-side-effects.webp',
    paper: 'https://openreview.net/pdf?id=oh9CqCyxSc',
  },
];
