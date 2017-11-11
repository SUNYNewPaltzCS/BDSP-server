#!/bin/bash
echo $SHELL

# Should be in root of bdsp, cd into node-builder
cd node-builder

# Create public downloads directory
mkdir public/downloads

if [ -n "$1" ]; then
		# Test if apk/apk-latest.apk exists
		if [ -f $1 ]; then
			echo "file exists, unzipping..."
			unzip $1 -d app

			# If buildApp.txt exists replace contents of buildApp.txt inside app
			if [ -f $3 ]; then
				cp $3 app/assets/buildApp.txt
			else
				echo "buildApp.txt does not exist, exiting"
				exit
			fi

			# Fourth argument is not used but relates to the logo
			if [ -f $4 ]; then
				cp $4 app/assets/logo.png
			else
				echo "no logo, proceeding regardless"
			fi

			# Zip new modified app
			cd app
			zip ../mod_app.apk * -r
			cd ../

			# Remove a previously sign app
			if [ -f signed_mod_app.apk ]; then
				rm signed_mod_app.apk
			fi

			# Sign the app
			signapk.sh $(pwd)/mod_app.apk

			# Make sure public/downloads exists, otherwise create it
			if [ -n $2 ]; then
				mv signed_mod_app.apk $2
			fi

			rm -rv app/
			rm -rv mod_app.apk
		else
			echo "File not found, please supply valid APK file name"
			echo "Usage: build_apk.sh source_apk output_apk"
		fi
else
	echo "No apk name given"
fi
