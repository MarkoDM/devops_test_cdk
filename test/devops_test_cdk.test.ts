
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as DevopsTestCdk from '../lib/devops_test_cdk-stack';

describe('DevopsTestCdkStack', () => {
  let app: cdk.App;
  let stack: DevopsTestCdk.DevopsTestCdkStack<cdk.StackProps>;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App({
        context: {
            'aws:account': '123456789012',
            'aws:region': 'us-east-1',
        }
    });
    stack = new DevopsTestCdk.DevopsTestCdkStack(app, 'MyTestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
    domainNames: ['app.example.com'],
    rootDomainName: 'example.com',
    containerPort: 80,
    containerName: 'test-container',
    githubOwner: 'testowner',
    githubRepo: 'testrepo',
    branch: 'main',
    codestarARN: 'arn:aws:codestar-connections:region:account:connection/test-connection',
    });
    template = Template.fromStack(stack);
  });

  test('VPC Created', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1);
  });

  test('ECS Cluster Created', () => {
    template.resourceCountIs('AWS::ECS::Cluster', 1);
  });

  test('ECR Repository Created', () => {
    template.hasResourceProperties('AWS::ECR::Repository', {
      RepositoryName: 'devops-test-repo-myteststack',
    });
  });

  test('Fargate Task Definition Created', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: [
        {
          Name: 'test-container',
          PortMappings: [
            {
              ContainerPort: 80,
            },
          ],
        },
      ],
    });
  });

  test('Application Load Balancer Created', () => {
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
  });

  test('HTTPS Listener Created', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
      Port: 443,
      Protocol: 'HTTPS',
    });
  });

  test('Route53 Record Created', () => {
    template.resourceCountIs('AWS::Route53::RecordSet', 2); // One for root domain, one for subdomain
  });

  test('CodePipeline Created', () => {
    template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
      Stages: [
        { Name: 'Source' },
        { Name: 'Build' },
        { Name: 'Deploy' },
      ],
    });
  });
});
