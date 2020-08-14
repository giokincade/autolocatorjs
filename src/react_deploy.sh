source ./config.txt

aws configure set aws_access_key_id $aws_key
aws configure set aws_secret_access_key $aws_secret
aws configure set default.region us-east-1
aws s3 cp ./test.js s3://autolocator/test.js
