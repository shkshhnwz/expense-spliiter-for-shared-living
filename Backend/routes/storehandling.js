const express = require('express');
const storerouter = express.Router();
const storeController = require('../controller/store/storeController');

storerouter.get('/', storeController.getdashboard);
storerouter.get('/setincome', storeController.getsetincome);
storerouter.post('/setincome', storeController.postsetincome);
storerouter.get('/splits', storeController.getsplit);
storerouter.post('/splits', storeController.postsplit);
storerouter.get('/mysplithistory', storeController.getsplithistroy);
storerouter.get('/download/expense/:expenseId', storeController.downloadpdf);
storerouter.get('/group', storeController.getgroup);
storerouter.post('/group', storeController.postgroup);
storerouter.get('/group-history', storeController.getgroupshistory);
module.exports = storerouter;