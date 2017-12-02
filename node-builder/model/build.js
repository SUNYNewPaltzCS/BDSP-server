// Load Modules
let fs = require('fs');
let exec = require('child_process').execSync;
let path = require('path');

// Resolve absolute paths
let buildScriptPath = path.join(__dirname, '..', 'build_apk.sh');
let apkPath = path.join(__dirname, '..', 'apk', 'app-latest.apk');
let apkDownloadPath = path.join(__dirname, '..', 'public', 'downloads', 'app-built.apk');
let buildAppTxtPath = path.join(__dirname, '..', 'buildApp.txt');

module.exports = {
	blank: function() { return {} },
	post: function(req, ret) {
		let table = req.body;
		let latOnSub = "";
		let lonOnSub = "";
		let buildApp = [];
		let currentStr = "";
		buildApp.push("table " + table.name); //add table name
		buildApp.push("id " +  table.id ); //add table name
		buildApp.push("url http://192.168.0.18:3000/node-builder/fusiontable/");
		buildApp.push("email " + req.session.email);
		console.log(req.session.email);
		table.columns.forEach(function(col) {
			let currentStr = "";
			if(col.inputType === 'unused') {
				
			}
			else if(col.inputType === 'lon-on-sub') {
				lonOnSub = col.name;
			}
			else if(col.inputType === 'lat-on-sub') {
				latOnSub = col.name;
			}
			else if(col.inputType === 'run') {
				currentStr = col.inputType + " 1 " + col.name;
				buildApp.push(currentStr);
			}
			else if(col.inputType === 'dropdown') {
				currentStr = col.inputType + " " + col.name + " [" + col.ddoptions.replace(/\s/g, "") + "]";
				buildApp.push(currentStr);
			}
			else if(col.inputType === 'gpsTracker') {
				currentStr = col.inputType + " 1 " + col.name + " " + col.gpsInterval + " start end";
				buildApp.push(currentStr);
			}
			else {
				currentStr = col.inputType + " " + col.name;
				buildApp.push(currentStr);
			}
		});
		if(latOnSub !== "" && lonOnSub !== "") {
			buildApp.push("locOnSub 1 " + latOnSub + " " + lonOnSub);
		}
		buildApp.push("endFile");
		let buildString = "";
		buildApp.forEach(function(line) {
			buildString += line + "\n";
		});
		fs.writeFileSync(buildAppTxtPath, buildString);
		function puts(error, stdout, stderr) { console.log(stdout) }
		exec(`${buildScriptPath} ${apkPath} ${apkDownloadPath} ${buildAppTxtPath}`, puts);
		ret(0, "app-built.apk");
	}
};
