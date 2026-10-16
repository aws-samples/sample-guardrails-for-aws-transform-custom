import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * Deploys greeting-service as a single ECS Fargate task with a public IP in
 * the account's default VPC. No load balancer, no dedicated VPC.
 *
 * Why so minimal: this repository exists so readers can run an AWS Transform
 * Custom experiment on real source code. The deployed endpoint only proves
 * the (before or after) application runs on AWS; it is not part of the
 * transformation story, so the infrastructure is kept as small as a working
 * one-click deploy allows. (AWS App Runner would have been smaller still,
 * but it is closed to new customers.)
 *
 * Cost design: one 0.25 vCPU / 512 MB task and one public IPv4 address,
 * roughly $13/month while running. Tear down with `cdk destroy`.
 *
 * NOTE: the resulting endpoint is PUBLIC, UNAUTHENTICATED, plain HTTP on the
 * task's public IP, and the IP changes whenever the task is replaced.
 * Acceptable for this harmless demo service; do not reuse as-is for anything
 * that handles real data.
 */
export class GreetingServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // JAVA_VERSION selects which state of the working tree the image builds:
    //   cdk deploy                          -> Java 8 ("before" tree on main)
    //   cdk deploy -c javaVersion=17        -> Java 17 (transformed tree)
    const javaVersion = this.node.tryGetContext('javaVersion') ?? '8';

    // DockerImageAsset builds the Dockerfile at the repo root during
    // `cdk deploy` and pushes it to the CDK bootstrap ECR repository.
    const image = new ecrAssets.DockerImageAsset(this, 'GreetingImage', {
      directory: path.join(__dirname, '..', '..'),
      buildArgs: { JAVA_VERSION: javaVersion },
      platform: ecrAssets.Platform.LINUX_AMD64,
    });

    // Use the account's default VPC instead of creating one. Fargate tasks
    // must live in a VPC, but a demo task does not justify provisioning a
    // dedicated network. If the default VPC was deleted in this account,
    // recreate it with: aws ec2 create-default-vpc
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    const cluster = new ecs.Cluster(this, 'GreetingCluster', {
      vpc,
      clusterName: 'greeting-service-demo',
    });
    cdk.Validations.of(cluster).acknowledge({
      id: 'AwsSolutions-ECS4',
      reason:
        'Container Insights is left off: the cluster runs one short-lived ' +
        'demo task, and enabling it adds cost for readers with no security ' +
        'benefit. Task logs go to CloudWatch Logs.',
    });

    const logGroup = new logs.LogGroup(this, 'GreetingLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      'GreetingTaskDef',
      {
        cpu: 256, // 0.25 vCPU
        memoryLimitMiB: 512,
      },
    );

    taskDefinition.addContainer('greeting', {
      image: ecs.ContainerImage.fromDockerImageAsset(image),
      portMappings: [{ containerPort: 8080 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'greeting-service',
        logGroup,
      }),
    });

    // CDK creates the execution role when the container is added. Its only
    // wildcard is ecr:GetAuthorizationToken, which has no resource-level
    // permissions; the image pull and log actions are resource-scoped.
    cdk.Validations.of(taskDefinition.obtainExecutionRole()).acknowledge({
      id: 'AwsSolutions-IAM5[Resource::*]',
      reason:
        'Only ecr:GetAuthorizationToken uses Resource "*"; the action does ' +
        'not support resource-level permissions. ECR pull and CloudWatch ' +
        'Logs actions are scoped to specific resources.',
    });

    // The task is reachable directly, so its security group is the public
    // surface: port 8080 open to the world, by design, for the demo endpoint.
    const securityGroup = new ec2.SecurityGroup(this, 'GreetingSecurityGroup', {
      vpc,
      description: 'greeting-service demo: public HTTP on 8080',
      allowAllOutbound: true, // pull image from ECR, write logs
    });
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080),
      'Demo endpoint (public, unauthenticated, plain HTTP)',
    );
    cdk.Validations.of(securityGroup).acknowledge({
      id: 'AwsSolutions-EC23',
      reason:
        'Single ingress rule on TCP 8080 for the demo endpoint, which serves ' +
        'a static greeting string and holds no data. Readers deploy it ' +
        'briefly in their own account and tear it down with cdk destroy.',
    });

    new ecs.FargateService(this, 'GreetingService', {
      cluster,
      taskDefinition,
      serviceName: 'greeting-service',
      desiredCount: 1,
      assignPublicIp: true,
      securityGroups: [securityGroup],
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      // Stop-then-start on redeploys: a demo does not need zero-downtime
      // rolling updates, and this avoids briefly paying for two tasks.
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      // Fail a deployment fast and roll back if the new task cannot start.
      circuitBreaker: { enable: true, rollback: true },
    });

    // No load balancer means no stable DNS name: the endpoint lives on the
    // task's public IP, discovered after deploy (see README "Verify the
    // deployment" for the copy-paste commands using these fixed names).
    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS cluster running the demo task',
    });
    new cdk.CfnOutput(this, 'ServiceName', {
      value: 'greeting-service',
      description: 'ECS service name (use with the README verify commands)',
    });
  }
}
