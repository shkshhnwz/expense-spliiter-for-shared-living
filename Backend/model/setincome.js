const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const incomeSchema = new Schema({
    user :{
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true
    },

    amount : {
        type : Number,
        required : true,
        min : 0
    },

    dateReceived :{
        type : Date,
        required : true,
    },

    incomeSource :{
        type : String,
        enum : ['Salary', 'Freelance','BusinessProfit', 'Rental', 'Investment', 'Other'],
        required : true,
        trim : true
    },

    description :{
        type : String,
        trim : true
    }


})

const Income = mongoose.model('Income', incomeSchema);
module.exports = Income;