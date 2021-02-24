const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Item = require('./itemModel');
const Branch = require('./branchModel')

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },

    email : {
        type: String,
        required: [true , 'user must have an email'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please provide a valid email']
    },
    role :{
        type: String,
        enum: ['user',  'admin'],
        default: 'user'
    
    },
    password: {
        type: String,
        required : [true , 'Please provide a password'],
        minlength: 8,
        select : false
    },
    passwordConfirm: {
        type: String,
        required : [true , 'Please confirm your password'],
        validate: {
            //this only works on creat OR save!!!
            validator: function(el){
                return el===this.password;  
            },
            message : 'Passwords are not the same'
        }
    },
    favItem: {
        type: mongoose.Schema.ObjectId,
        ref: 'Item'
    },
    favBranch: {
        type: mongoose.Schema.ObjectId,
        ref: 'Branch'
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpired: Date,
    active: {
        type :Boolean,
        default: true,
        select: false
    }
});


userSchema.pre('save', async function(next) {
    //only run this function if password was actually modified
    if (!this.isModified('password')) return next();

    //hash the password with a cost of 12
    this.password =  await bcrypt.hash(this.password, 12)

    //delete passwordConfirm field
    this.passwordConfirm = undefined;
    next();
});

userSchema.pre('save', function(next){
    if (!this.isModified('password') || this.isNew) return next();

    this.passwordChangedAt = Date.now()-1000;
    next();
});

userSchema.pre(/^find/, function(next) {
    //this point to current query
    this.find({active: {$ne : false}});
    next();
});

userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword,userPassword);
};
userSchema.methods.changedPasswordAfter = function(JWTTimeStamp) {
    if (this.passwordChangedAt){
        const changedTimeStamp = parseInt(this.passwordChangedAt.getTime()/1000 , 10);
        return JWTTimeStamp<changedTimeStamp; 
    }   
    //false means not changed
    return false;
};

userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

    console.log({resetToken} , this.passwordResetToken);

    this.passwordResetExpired = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

const User = mongoose.model('User' , userSchema);
module.exports = User; 