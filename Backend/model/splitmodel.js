const { experimentalSetDeliveryMetricsExportedToBigQueryEnabled } = require('firebase/messaging/sw');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SplitterDetails = new Schema({
    name :{
        type : String,
        required : true
    },
    contact:{
        type : String,
        required : true
    },
    amountOwned:{
        type : Number,
        min : 0,
        required : true
    },
    splitValue:{
        type : Number,
        required : true
    },
    hasSettled :{
        type : Boolean,
        default : false
    }
}, {_id : false});

const ExpenseSchema = new Schema ({
    description :{
        type : String,
        required : true
    },
    amount :{
        type : Number,
        min : 0,
        required : true
    },
    date :{
        type : Date,
        required: true
    },
    paidBy:{
        type : String,
        ref : 'User',
        required : true
    },
    splitMethod :{
        type : String,
        required : true,
        enum : ['equal', 'amount', 'percentage', 'shares']
    },
    splitters : [SplitterDetails],

    user :{
        type : String,
        ref : 'User',
        required : true
    }
}, {timestamps : true});

module.exports = mongoose.model('Expense', ExpenseSchema);