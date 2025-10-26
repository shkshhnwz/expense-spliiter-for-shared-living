const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Name is required.']
    },
    email: {
        type: String,
        required: [true, 'Email is required.'],
        unique: true, 
        lowercase: true, 
        match: [/\S+@\S+\.\S+/, 'is invalid'] 
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required.']
    },
    
    firebaseUid: {
        type: String,
        required: true,
        unique: true
    }
}, {
    
    timestamps: true
});


const User = mongoose.model('User', userSchema);
module.exports = User;