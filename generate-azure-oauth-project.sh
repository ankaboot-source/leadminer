#!/bin/bash

# AZ Cli Install
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates curl gnupg lsb-release
sudo mkdir -p /etc/apt/keyrings

curl -sLS https://packages.microsoft.com/keys/microsoft.asc |
  gpg --dearmor | sudo tee /etc/apt/keyrings/microsoft.gpg > /dev/null

sudo chmod go+r /etc/apt/keyrings/microsoft.gpg

AZ_DIST=$(lsb_release -cs)
echo "Types: deb
URIs: https://packages.microsoft.com/repos/azure-cli/
Suites: ${AZ_DIST}
Components: main
Architectures: $(dpkg --print-architecture)
Signed-by: /etc/apt/keyrings/microsoft.gpg" | sudo tee /etc/apt/sources.list.d/azure-cli.sources

sudo apt-get update
sudo apt-get install azure-cli



#### Create Web Oauth2 Project

# login to azure tenant
az login --allow-no-subscriptions

# Register app
APP_ID=$(az ad app create --display-name leadminer.io-dev --web-redirect-uris http://localhost:8081/api/imap/mine/sources/azure/callback http://localhost:54321/auth/v1/callback --sign-in-audience "AzureADandPersonalMicrosoftAccount" --query appId -o tsv)

# Create Client Secret
SECRET=$(az ad app credential reset --id $APP_ID --query password -o tsv)

echo "Client ID: $APP_ID"
echo "Client Secret: $SECRET"
