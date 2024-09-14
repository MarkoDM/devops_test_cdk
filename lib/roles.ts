import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export function createExecutionRole(scope: Construct): iam.Role {
    const executionRole = new iam.Role(scope, "ExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        ),
      ],
    });
  
    return executionRole;
}

export function createPipelineRole(scope: Construct): iam.Role {
    const pipelineRole = new iam.Role(scope, 'PipelineRole', {
        assumedBy: new iam.ServicePrincipal('codepipeline.amazonaws.com'),
        managedPolicies: [
            iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodePipeline_FullAccess'),
            iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonECS_FullAccess'),
            iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'),
            iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        ],
    });

    // Instead of managedPolicies fine grain necessary permissions to the pipeline role
    pipelineRole.addToPolicy(new iam.PolicyStatement({
        actions: [
          'ecs:UpdateService',
          'ecs:DescribeServices',
          'ecs:DescribeTaskDefinition',
          'ecs:ListTasks',
          'ecs:DescribeTasks',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'ecr:CompleteLayerUpload',
          'ecr:UploadLayerPart',
          'ecr:InitiateLayerUpload',
          'ecr:PutImage',
          'ecr:GetAuthorizationToken',
          'logs:*',
          's3:*',
          'codestar-connections:UseConnection',
        ],
        resources: ['*'],
    }));
  
    return pipelineRole;
}

export function createBuildRole(scope: Construct): iam.Role {
    const buildRole = new iam.Role(scope, 'BuildRole', {
        assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      });
  
    buildRole.addToPolicy(new iam.PolicyStatement({
        actions: [
            "ecr:BatchCheckLayerAvailability",
            "ecr:DescribeImages",
            "ecr:DescribeRepositories",
            "ecr:ListImages",
            'ecr:GetDownloadUrlForLayer',
            'ecr:BatchGetImage',
            'ecr:CompleteLayerUpload',
            'ecr:UploadLayerPart',
            'ecr:InitiateLayerUpload',
            'ecr:PutImage',
            'ecr:GetAuthorizationToken',
            'logs:*',
            's3:*',
            'codestar-connections:UseConnection',
            ],
        resources: ['*'],
    }));
  
    return buildRole;
}