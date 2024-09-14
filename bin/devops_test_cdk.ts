#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DevopsTestCdkStack } from '../lib/devops_test_cdk-stack';
const settings = require('../settings.json');

const app = new cdk.App();

// We are using simple for loop to crete all stacks defined in settings.json
// For further upgrade, if needed, this should be refactored to use factory pattern.
for (const project of settings.projects) {
  new DevopsTestCdkStack(app, `Project-${project.projectName}`, {
    codestarARN: project.codestarARN,
    domainNames: project.domainNames,
    rootDomainName: project.rootDomainName,
    containerPort: project.containerPort,
    containerName: project.containerName,
    githubOwner: project.githubOwner,
    githubRepo: project.githubRepo,
    branch: project.branch,
    env: {
      account: settings.awsAccountId,
      region: settings.region,
    },
  });
}