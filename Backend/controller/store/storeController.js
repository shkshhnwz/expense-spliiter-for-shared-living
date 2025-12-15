const User = require('../../model/User');
const Income = require('../../model/setincome');
const Expense = require('../../model/splitmodel');
const PDFDocument = require('pdfkit');
const Group = require('../../model/Group');
const mongoose = require('mongoose');



exports.getdashboard = async (req, res, next) => {
    // 1. Safety Check
    if (!req.user || !req.user._id) return res.redirect('/login');

    // 2. Define IDs in BOTH formats (String and ObjectId)
    // This ensures we catch the data no matter how it was saved
    const userid = new mongoose.Types.ObjectId(req.user._id);
    const useridStr = req.user._id.toString();
    const userEmail = req.user.email;

    try {
        const userDetails = await User.findById(userid);
        const incomeAgg = await Income.aggregate([
            { $match: { user: userid } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalIncome = incomeAgg.length > 0 ? incomeAgg[0].total : 0;

        const receivablesAgg = await Expense.aggregate([
            {
                $match: {
                    paidBy: { $in: [userid, useridStr] }
                }
            },
            { $unwind: "$splitters" },
            { $match: { "splitters.hasSettled": false } },

            {
                $match: {
                    "splitters.userId": { $nin: [userid, useridStr] }
                }
            },
            { $group: { _id: null, total: { $sum: "$splitters.amountOwned" } } }
        ]);
        const totalReceivables = receivablesAgg.length > 0 ? receivablesAgg[0].total : 0;

        const payablesAgg = await Expense.aggregate([

            {
                $match: {
                    paidBy: { $nin: [userid, useridStr] }
                }
            },
            { $unwind: "$splitters" },
            {
                $match: {
                    $or: [
                        { "splitters.userId": { $in: [userid, useridStr] } },
                        { "splitters.contact": userEmail }
                    ],
                    "splitters.hasSettled": false
                }
            },
            { $group: { _id: null, total: { $sum: "$splitters.amountOwned" }, count: { $sum: 1 } } }
        ]);
        const totalPayables = payablesAgg.length > 0 ? payablesAgg[0].total : 0;
        const pendingBillsCount = payablesAgg.length > 0 ? payablesAgg[0].count : 0;

        const categoryStats = await Expense.aggregate([
            {
                $match: {
                    $or: [

                        { paidBy: { $in: [userid, useridStr] } },

                        { "splitters.userId": { $in: [userid, useridStr] } },
                        { "splitters.contact": userEmail }
                    ]
                }
            },
            { $unwind: "$splitters" },
            {
                $match: {
                    $or: [
                        { "splitters.userId": { $in: [userid, useridStr] } },
                        { "splitters.contact": userEmail }
                    ]
                }
            },
            { $group: { _id: "$category", total: { $sum: "$splitters.amountOwned" } } }
        ]);

        const chartLabels = categoryStats.map(stat => stat._id || 'General');
        const chartData = categoryStats.map(stat => stat.total);

        const pendingBillsList = await Expense.aggregate([

            {
                $match: {
                    paidBy: { $nin: [userid, useridStr] }
                }
            },
            { $unwind: "$splitters" },
            {
                $match: {
                    $or: [
                        { "splitters.userId": { $in: [userid, useridStr] } },
                        { "splitters.contact": userEmail }
                    ],
                    "splitters.hasSettled": false
                }
            },
            {
                $project: {
                    description: 1,
                    date: 1,
                    amount: "$splitters.amountOwned"
                }
            }
        ]);

        const formattedBills = pendingBillsList.map(b => ({
            desc: b.description,
            date: b.date,
            amount: b.amount
        }));

        res.render('store/dashboard', {
            pageTitle: "Home Page",
            stylesheet: "/dashboard.css",
            user: userDetails,
            TotalIncome: totalIncome,
            Receivables: totalReceivables.toFixed(2),
            Payables: totalPayables.toFixed(2),
            PendingBills: pendingBillsCount,
            pendingBillsList: formattedBills,
            chartLabels: chartLabels,
            chartData: chartData
        });

    } catch (err) {
        console.log('Error loading dashboard', err);
        next(err);
    }
}


exports.getprofile = (req, res, next) => {
    res.render('store/profile', {
        pageTitle: "Profile Page",
        user: req.user
    })
}


exports.getsetincome = (req, res, next) => {
    res.render('store/setincome', {
        pageTitle: "Set Income Page",
        stylesheet: "/setincome.css",
        user: req.user
    })
}

exports.postsetincome = async (req, res, next) => {
    const userid = req.user && req.user._id;
    if (!userid) return res.redirect('/login');

    const { amount, dateReceived, incomeSource, description } = req.body;

    if (!amount || !dateReceived || !incomeSource) {
        return res.redirect('/dashboard/setincome?error=All fields are required');
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
        return res.redirect('/dashboard/setincome?error=Amount must be positive');
    }

    const validSource = ['Salary', 'Freelance', 'BusinessProfit', 'Rental', 'Investment', 'Other'];
    if (!validSource.includes(incomeSource)) {
        return res.redirect('/dashboard/setincome?error=Invalid Income Source');
    }

    try {
        const newIncome = new Income({
            user: userid,
            amount: amountNum,
            dateReceived: dateReceived,
            incomeSource: incomeSource,
            description: description
        });

        await newIncome.save();

        return res.redirect('/dashboard?success=Income added successfully');

    } catch (err) {
        console.error('Error saving income:', err);
        return res.redirect('/dashboard/setincome?error=Something went wrong');
    }
}

exports.getIncomeHistory = async (req, res, next) => {
    const userid = req.user && req.user._id;

    if (!userid) {
        return res.redirect('/login');
    }

    try {
        const incomes = await Income.find({ user: userid })
            .sort({ dateReceived: -1 });

        res.render('store/incomehistory', {
            pageTitle: 'Income History',
            path: '/dashboard/incomehistory',
            incomeList: incomes,
            user: req.user 
        });

    } catch (err) {
        console.error('Error fetching income history:', err);
        res.redirect('/dashboard?error=Could not load history');
    }
};

exports.getsplit = async (req, res, next) => {
    try {

        const userid = req.user && req.user._id;

        if (!userid) {
            return res.redirect('/login');
        }

        const userGroups = await Group.find({ "members.userId": userid });

        res.render('store/split', {
            pageTitle: "Split a bill",
            stylesheet: "/split.css",
            user: req.user,
            groups: userGroups
        });

    } catch (err) {
        console.error("Error loading split page:", err);
        next(err);
    }
}

exports.postsplit = async (req, res, next) => {
    try {
        const userid = req.user && (req.user._id || req.user.uid);
        if (!userid) return res.redirect('/login');

        const {
            expenseType,
            groupId,
            splitName,
            payableAmount,
            dateofExpense,
            splitterNames,
            splitterContact,
            splitValues,
            splitMethod,
            groupSplitMethod
        } = req.body;

        const amount = parseFloat(payableAmount);

        if (!splitName || isNaN(amount) || amount <= 0 || !dateofExpense) {
            return res.redirect('/dashboard/split?error=Invalid data');
        }

        const payerName = req.user.name || req.user.displayName || "Me";
        const payerContact = req.user.email || req.user.contact || "N/A";

        let finalSplitters = [];
        let finalGroupId = null;
        let activeSplitMethod = splitMethod || 'equal';

        if (expenseType === 'personal') {
            activeSplitMethod = splitMethod || 'equal';
            const namesArr = Array.isArray(splitterNames) ? splitterNames : (splitterNames ? [splitterNames] : []);
            const contactArr = Array.isArray(splitterContact) ? splitterContact : (splitterContact ? [splitterContact] : []);
            const valuesArr = Array.isArray(splitValues) ? splitValues : (splitValues ? [splitValues] : []);

            finalSplitters.push({
                name: payerName,
                contact: payerContact,
                amountOwned: 0,
                splitValue: 0,
                hasSettled: true
            });

            for (let i = 0; i < namesArr.length; i++) {
                let calculatedShare = 0;
                if (activeSplitMethod === 'equal') {
                    const totalPeople = namesArr.length + 1;
                    calculatedShare = amount / totalPeople;
                }
                else if (activeSplitMethod === 'amount') {
                    calculatedShare = parseFloat(valuesArr[i]) || 0;
                }
                else if (activeSplitMethod === 'percentage') {
                    const percent = parseFloat(valuesArr[i]) || 0;
                    calculatedShare = (percent / 100) * amount;
                }
                finalSplitters.push({
                    name: namesArr[i],
                    contact: contactArr[i],
                    amountOwned: calculatedShare,
                    splitValue: parseFloat(valuesArr[i]) || 0,
                    hasSettled: false
                });
            }

        } else {
            if (!groupId) return res.redirect('/dashboard/split?error=Group ID required');

            finalGroupId = groupId;
            activeSplitMethod = 'equal';

            // 1. Fetch Group
            const groupDoc = await Group.findById(groupId);
            if (!groupDoc) return res.redirect('/dashboard/split?error=Group not found');


            let allMembers = [];

            allMembers.push({
                name: payerName,
                contact: payerContact,
                isPayer: true
            });

            groupDoc.members.forEach(m => {

                if (m.userId && m.userId.toString() === userid.toString()) return;

                allMembers.push({
                    name: m.name,
                    contact: m.contact || m.email || "N/A",
                    userId: m.userId,
                    isPayer: false
                });
            });
            const totalPeople = allMembers.length;
            const sharePerPerson = amount / totalPeople;


            finalSplitters = allMembers.map(member => {
                return {
                    userId: member.userId,
                    name: member.name,
                    contact: member.contact,
                    amountOwned: sharePerPerson,
                    splitValue: 1,
                    hasSettled: member.isPayer
                };
            });
        }

        const newExpense = new Expense({
            description: splitName,
            category: expenseType || 'General',
            amount,
            date: dateofExpense,
            paidBy: userid,
            splitMethod: activeSplitMethod,
            splitters: finalSplitters,
            user: userid,
            group: finalGroupId
        });

        await newExpense.save();
        return res.redirect('/dashboard/mysplithistory');

    } catch (err) {
        console.error("Error in postsplit:", err);
        next(err);
    }
};

exports.downloadpdf = async (req, res, next) => {
    try {
        const { expenseId } = req.params;
        const userid = req.user && (req.user._id || req.user.uid);
        if (!userid) return res.redirect('/login');

        const expense = await Expense.findOne({ _id: expenseId, user: userid });
        if (!expense) return res.status(404).send("Not found or unauthorized");

        const payer = await User.findById(expense.paidBy);
        const payerName = payer?.name || payer?.displayName || "Payer";
        const payerContact = payer?.email || payer?.contact || "N/A";


        if (expense.splitters.length > 0) {
            expense.splitters[0].name = payerName;
            expense.splitters[0].contact = payerContact;
        }

        const filename = `Expense_${expense._id}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        const doc = new PDFDocument({ margin: 30 });
        doc.pipe(res);

        const P = 30;
        const W = doc.page.width - P * 2;
        const X_START = P;
        const LINE_HEIGHT_GUESS = 18;

        doc.fontSize(24).font('Helvetica-Bold').text(`Expense Split: ${expense.description}`, { align: "center" });
        doc.moveDown();

        doc.fontSize(12).font('Helvetica');
        const metaY = doc.y;

        doc.text(`Date: ${new Date(expense.date).toLocaleDateString()}`, X_START, metaY);
        doc.text(`Paid By: ${payerName}`, X_START, metaY + LINE_HEIGHT_GUESS);

        const rightColX = P + W * 0.5;
        const rightColW = W * 0.5;

        doc.text(`Total Amount: Rs. ${expense.amount.toFixed(2)}`, rightColX, metaY, { align: "right", width: rightColW });
        doc.text(`Split Method: ${expense.splitMethod}`, rightColX, metaY + LINE_HEIGHT_GUESS, { align: "right", width: rightColW });

        doc.y = metaY + LINE_HEIGHT_GUESS * 2 + 10;
        doc.moveDown();

        const cols = [
            { title: "Name", x: P, w: W * 0.25 },
            { title: "Contact", x: P + W * 0.25, w: W * 0.30 },
            { title: "Share/Value", x: P + W * 0.55, w: W * 0.20 },
            { title: "Amount Owed", x: P + W * 0.75, w: W * 0.25 }
        ];

        const drawHeader = (doc, cols, P, W) => {
            doc.font("Helvetica-Bold").fontSize(11);
            const headerY = doc.y;
            cols.forEach(c => doc.text(c.title, c.x, headerY, { width: c.w }));
            doc.moveDown(0.5);
            doc.moveTo(P, doc.y).lineTo(doc.page.width - P, doc.y).stroke();
            doc.font("Helvetica").fontSize(10);
            doc.moveDown(0.2);
        };

        drawHeader(doc, cols, P, W);

        const ROW_PADDING = 6;
        const bottomMargin = 60;

        for (let i = 0; i < expense.splitters.length; i++) {
            const s = expense.splitters[i];

            const estRowHeight = 40;
            if (doc.y > doc.page.height - bottomMargin - estRowHeight) {
                doc.addPage();
                drawHeader(doc, cols, P, W);
            }

            const sv = !isNaN(parseFloat(s.splitValue))
                ? (expense.splitMethod === "amount"
                    ? `Rs. ${parseFloat(s.splitValue).toFixed(2)}`
                    : (expense.splitMethod === "percentage"
                        ? `${parseFloat(s.splitValue)}%`
                        : `${parseFloat(s.splitValue)}`))
                : "N/A";

            const owed = !isNaN(parseFloat(s.amountOwned))
                ? `Rs. ${parseFloat(s.amountOwned).toFixed(2)}`
                : "N/A";

            doc.font("Helvetica").fontSize(10); // Ensure current font settings for height calculation

            const nameText = s.name || "N/A";
            const contactText = s.contact || "N/A";
            const shareText = sv;
            const owedText = owed;

            // Measure heights for each cell with the column width
            const hName = doc.heightOfString(nameText, { width: cols[0].w });
            const hContact = doc.heightOfString(contactText, { width: cols[1].w });
            const hShare = doc.heightOfString(shareText, { width: cols[2].w });
            const hOwed = doc.heightOfString(owedText, { width: cols[3].w });

            const maxCellHeight = Math.max(hName, hContact, hShare, hOwed);
            const startY = doc.y;

            // Draw each cell using the explicit starting Y (startY)
            doc.text(nameText, cols[0].x, startY, { width: cols[0].w, continued: false });
            doc.text(contactText, cols[1].x, startY, { width: cols[1].w, continued: false });
            doc.text(shareText, cols[2].x, startY, { width: cols[2].w, continued: false });
            doc.text(owedText, cols[3].x, startY, { width: cols[3].w, align: "right", continued: false });

            // Calculate the Y position for the next row
            const nextY = startY + maxCellHeight + ROW_PADDING;

            // Draw a thin separator line under the row
            doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(P, nextY - 1).lineTo(doc.page.width - P, nextY - 1).stroke();

            // Advance cursor to start of the next row
            doc.y = nextY;
        }

        // --- FOOTER AT BOTTOM ---
        const footerText = "Generated by ExpenseCare: Expense Splitter For Shared Living";
        const footerY = doc.page.height - 50;

        // Ensure there is enough space for the footer
        if (doc.y + 40 > footerY) {
            doc.addPage();
        }

        // Draw a separator line above the footer
        const sepY = doc.page.height - 70;
        doc.strokeColor('#cccccc').lineWidth(0.5).moveTo(P, sepY).lineTo(doc.page.width - P, sepY).stroke();

        // Draw footer text
        doc.fillColor('gray').fontSize(10);
        doc.text(footerText, 0, footerY, { align: "center" });

        doc.end();

    } catch (err) {
        console.error("Error generating PDF:", err);
        res.status(500).send("PDF generation failed");
        // next(err); 
    }
};


exports.getsplithistory = async (req, res, next) => {
    try {
        const userid = req.user && (req.user._id || req.user.uid);
        if (!userid) return res.redirect('/login');

        const newExpense = await Expense.find({
            $or: [
                { user: userid },
                { paidBy: userid }
            ]
        }).sort({ date: -1 });

        res.render('store/mysplithistory', {
            newExpense: newExpense,
            pageTitle: "History of Splits",
            stylesheet: "/mysplithistory.css",
            user: req.user
        })
    }
    catch (err) {
        next(err);
    }
}

exports.getgroup = (req, res, next) => {
    try {
        const userid = req.user && (req.user._id || req.user.uid);
        if (!userid) return res.redirect('/login');

        res.render('store/group', {
            pageTitle: "Make Group",
            stylesheet: "/group.css",
            user: req.user
        })

    } catch (err) {
        console.log("Error is cought while getting group home page", err);
    }
}


exports.postgroup = async (req, res, next) => {
    try {
        // 1. Auth Check
        const userid = req.user && (req.user._id || req.user.uid);
        if (!userid) {
            return res.redirect('/login');
        }

        const {
            name,
            grouptype,
            budget,
            members // Array of member objects from your form
        } = req.body;

        const initialMembers = [];

        // 2. Add the Admin (You)
        initialMembers.push({
            name: req.user.name || req.user.displayName || "Admin",
            contact: req.user.email,
            userId: userid
        });


        if (members && Array.isArray(members)) {

            for (const member of members) {
                if (member.contact) {
                    let foundId = null;

                    const existingUser = await User.findOne({ email: member.contact });

                    if (existingUser) {
                        foundId = existingUser._id;
                    }

                    initialMembers.push({
                        name: member.name,
                        contact: member.contact,
                        userId: foundId
                    });
                }
            }
        }

        const group = new Group({
            name: name,
            type: grouptype,
            budget: budget || 0,
            members: initialMembers,
            createdBy: userid
        });

        await group.save();
        console.log("Group Created Successfully");

        // Redirect to history so you can see the new group immediately
        res.redirect('/dashboard/group-history');

    } catch (err) {
        console.log("Error caught while creating group:", err);
        res.redirect('/dashboard?error=GroupCreationMsg');
    }
}

exports.getgroupshistory = async (req, res, next) => {
    try {

        const userid = req.user && (req.user._id || req.user.uid);
        if (!userid) return res.redirect('/login');
        const groups = await Group.find({
            "members.userId": userid
        }).sort({ createdAt: -1 });
        res.render('store/group-history', {
            pageTitle: "Your Groups",
            stylesheet: "/group.css",
            user: req.user,
            groups: groups
        });

    } catch (err) {
        console.log("Error caught while fetching group history:", err);
        res.redirect('/dashboard');
    }
}

exports.getGroupDetails = async (req, res, next) => {
    try {
        const groupId = req.params.groupId;
        const userid = req.user._id;


        const group = await Group.findById(groupId);

        if (!group) {
            console.log("Group not found");
            return res.redirect('/dashboard/group-history');
        }
        const isMember = group.members.some(m =>
            m.userId && m.userId.toString() === userid.toString()
        );

        if (!isMember) {
            return res.redirect('/dashboard?error=Unauthorized');
        }


        const groupExpenses = await Expense.find({ group: groupId })
            .sort({ date: -1 });

        res.render('store/group-detail', {
            pageTitle: group.name,
            stylesheet: "/group.css",
            user: req.user,
            group: group,
            expenses: groupExpenses
        });

    } catch (err) {
        console.log("Error loading group details:", err);
        next(err);
    }
};

exports.postDeleteExpense = async (req, res, next) => {
    const userid = req.user && (req.user._id || req.user.uid);
    const expenseId = req.body.expenseId;

    if (!userid) return res.redirect('/login');

    try {
        const expense = await Expense.findById(expenseId);

        if (!expense) {
            console.log("Expense not found.");
            return res.redirect('/dashboard/mysplithistory');
        }

        if (expense.paidBy.toString() !== userid.toString()) {
            console.log("Unauthorized delete attempt.");
            return res.redirect('/dashboard/mysplithistory?error=Unauthorized');
        }

        await Expense.findByIdAndDelete(expenseId);
        console.log("Expense deleted successfully.");

        res.redirect('/dashboard/mysplithistory');

    } catch (err) {
        console.log("Error deleting expense:", err);
        next(err);
    }
};

exports.postDeleteGroup = async (req, res, next) => {
    const userid = req.user && (req.user._id || req.user.uid);
    const groupId = req.body.groupId;

    if (!userid) return res.redirect('/login');

    try {
        const group = await Group.findById(groupId);

        if (!group) {
            return res.redirect('/dashboard/group-history');
        }

        if (group.createdBy.toString() !== userid.toString()) {
            console.log("Unauthorized group delete attempt.");
            return res.redirect('/dashboard/group-history?error=OnlyAdminCanDelete');
        }

        await Group.findByIdAndDelete(groupId);
        console.log("Group deleted successfully.");

        res.redirect('/dashboard/group-history');

    } catch (err) {
        console.log("Error deleting group:", err);
        next(err);
    }
};