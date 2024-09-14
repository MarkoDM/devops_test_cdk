import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { createBuildRole, createExecutionRole, createPipelineRole } from './roles';

// This is an example how we can use generics to load properties for this stack.
// This can be aplied to any resource used in the stack
// and pulled from this file for better separation and reusability.
// We also get type checking for settings this way.
// For simplicity, I just created this for top level.
interface ProjectProps<T extends cdk.StackProps> extends cdk.StackProps {
  domainNames: string[];
  rootDomainName: string;
  containerPort: number;
  containerName: string;
  githubOwner: string;
  githubRepo: string;
  branch: string;
  codestarARN: string;
}

export class DevopsTestCdkStack<T extends cdk.StackProps> extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ProjectProps<T>) {
    super(scope, id, props);

    // ECR repository for images
    const repositoryName = `devops-test-repo-${id.toLowerCase()}`;

    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 2 });

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, "lb", {
      vpc,
      internetFacing: true,
    });

    // Define ECS Cluster
    const cluster = new ecs.Cluster(this, 'EcsCluster', {
      vpc
    });

    // Define ECR repository
    // Define removal policy and emptyOnDelete to clear entire stack on delete
    const ecrRepo = new ecr.Repository(this, 'EcrRepo', {
      repositoryName,
      emptyOnDelete: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const executionRole = createExecutionRole(this);

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole,
    });

    // Adding a simple container image that will we replaced on first deploy
    const container = taskDefinition.addContainer('AppContainer', {
      image: ecs.ContainerImage.fromRegistry("public.ecr.aws/ecs-sample-image/name-server:latest"),
      containerName: props.containerName,
      memoryLimitMiB: 512,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'ecs' }),
      portMappings: [
        {
          containerPort: props.containerPort,
        },
      ],
    });

    const service = new ecs.FargateService(this, 'FargateService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
    });

    const mainHostedZone = route53.HostedZone.fromLookup(this, 'MainHostedZone', {
      domainName: props.rootDomainName,
    });

    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: props.rootDomainName,
      validation: acm.CertificateValidation.fromDns(mainHostedZone),
    });

    // For HTTPS we need at least one target
    const listener = loadBalancer.addListener('Listener', {
      port: 443,
      certificates: [certificate],
      open: true,
    });

    listener.addTargets('ECS', {
      port: props.containerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: '/',
        port: `${props.containerPort}`,
        interval: cdk.Duration.seconds(30), // The interval between health checks
        timeout: cdk.Duration.seconds(5), // The timeout for health check requests
      },
    });

    new route53.ARecord(this, `RootRecord`, {
      zone: mainHostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(loadBalancer)),
    });

    // Configure Multiple Domain Names
    props.domainNames.forEach((domainName, index) => {
      // Create an ACM certificate for each domain to avoid warnings
      const certificate = new acm.Certificate(this, `Certificate-${index}`, {
        domainName,
        validation: acm.CertificateValidation.fromDns(mainHostedZone),
      });

      // Attach the certificate to the ALB listener
      listener.addCertificates(`ListenerCertificate-${index}`, [certificate]);

      // Create Route 53 alias record pointing the domain to the ALB
      new route53.ARecord(this, `AliasRecord-${index}`, {
        zone: mainHostedZone,
        target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(loadBalancer)),
        recordName: domainName.split('.')[0], // Extract subdomain (e.g., 'app' from 'app.example.com')
      });
    });

    // Create the CodePipeline Artifact Bucket
    // Define removal policy and delete object to clear entire stack on delete
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create the CodePipeline Role from policies
    const pipelineRole = createPipelineRole(this);

    artifactBucket.grantReadWrite(pipelineRole);
    ecrRepo.grantPullPush(pipelineRole);
    
    const buildRole = createBuildRole(this);

    // This will build docker image and push to registry
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
        privileged: true,
        computeType: codebuild.ComputeType.SMALL
      },
      environmentVariables: {
        'ECR_REPO_URI': { value: ecrRepo.repositoryUri },
        'IMAGE_REPO_NAME': { value: repositoryName },
        'IMAGE_TAG': { value: 'latest' },
        'CONTAINER_NAME': { value: props.containerName },
      },
      role: buildRole,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO_URI'
            ]
          },
          build: {
            commands: [
              'echo Building the Docker image...',
              'docker build -t $IMAGE_REPO_NAME .',
              'docker tag $IMAGE_REPO_NAME:latest $ECR_REPO_URI:latest'
            ]
          },
          post_build: {
            commands: [
              'echo Build completed',
              'echo Pushing the Docker image to $ECR_REPO_URI:latest',
              'docker push $ECR_REPO_URI:latest',
              'echo Writing image definitions file...',
              "printf '[{\"name\":\"'$CONTAINER_NAME'\",\"imageUri\":\"%s\"}]' $ECR_REPO_URI:latest > imagedefinitions.json",
            ]
          }
        },
        artifacts: {
          files: [
            '**/*',
            "imagedefinitions.json"
          ]
        }
      })
    });

    // Set Up the CodePipeline
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();
    // Source action based on CodeStar connection
    // Triggered on code push to selected branch
    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: 'CodeStar_Source',
      owner: props.githubOwner,
      repo: props.githubRepo,
      branch: props.branch,
      output: sourceOutput,
      connectionArn: props.codestarARN, // Use the ARN of the CodeStar connection
    });
    // Use build project do build image and push to registry
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput]
    });

    // Define deploy action
    const deployAction = new codepipeline_actions.EcsDeployAction({
      actionName: 'DeployToEcs',
      service,
      input: buildOutput,
    });

    // Define CodePipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'DevOpsTestPipeline',
      artifactBucket: artifactBucket,
      role: pipelineRole,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'Build',
          actions: [buildAction],
        },
        {
          stageName: 'Deploy',
          actions: [deployAction],
        },
      ],
    });
  }
}
