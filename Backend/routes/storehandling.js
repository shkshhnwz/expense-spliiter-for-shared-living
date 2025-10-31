const express = require('express');
const storerouter = express.Router();
const storeController = require('../controller/store/storeController');

storerouter.get('/', storeController.getdashboard);
storerouter.get('/setincome', storeController.getsetincome);
storerouter.post('/setincome', storeController.postsetincome);
storerouter.get('/splits', storeController.getsplit);
storerouter.post('/splits', storeController.postsplit);
module.exports = storerouter;