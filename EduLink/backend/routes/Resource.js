const express = require('express');
const { getResources, createResource } = require('../controllers/Resource');

const router = express.Router();

router.get('/:classroom', getResources);
router.post('/', createResource);

module.exports = router;