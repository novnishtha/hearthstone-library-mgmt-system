const { generateBookDescription } = require('../services/aiService');

async function createBookDescription(req, res, next) {
  try {
    const { title, author, categories, category, publishedYear } = req.body;
    const description = await generateBookDescription({
      title,
      author,
      categories,
      category,
      publishedYear,
    });

    res.json({
      success: true,
      data: { description },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createBookDescription };
