const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const billsSchema = new Schema({
    number:{
        type: number,
        required: true
    },

    nameofbill:{
        type:String,
        required : true
    }
})

const Bills = mongoose.model('Bills', billsSchema);
module.exports = Bills;