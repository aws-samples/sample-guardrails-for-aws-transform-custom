#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { GreetingServiceStack } from '../lib/greeting-service-stack';

const app = new cdk.App();

// cdk-nag AwsSolutions checks run on every synth. Rules that do not fit this
// demo stack are acknowledged, with reasons, in greeting-service-stack.ts.
cdk.Validations.of(app).addPlugins(new AwsSolutionsChecks(app));

new GreetingServiceStack(app, 'GreetingServiceStack', {
  // Deploys into the account/region of the AWS profile running `cdk deploy`.
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description:
    'greeting-service sample app: single ECS Fargate task (blog reference deployment)',
});
