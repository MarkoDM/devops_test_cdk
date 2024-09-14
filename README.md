## Steps for deployment and prerequisites

1. Have AWS CDK installed and configured
2. Run `npm install`
3. Make sure to fill `settings.json`.
   - There is a projects array for multiple project
   - containerPort should stay at 3000 as it is a current setup for this test
   - codestar connection is chosen for connecting repos
4. First time for every environment please run `cdk bootstrap`
   - This will setup environment for painless deployment using CDK
   - `cdk bootstrap` will use default profile
   - Use `cdk bootstrap <accountID>/<region>` or `cdk bootstrap --profile prod` for specific environments
   - Use `cdk bootstrap <accountID>/<region> <accountID>/<region>` to bootstrap multiple environments at the same time, provide multiple arguments.
5. Use `cdk deploy` to deploy to environment set in settings.json

Optionally run `npm test` to run UT.

## Cleanup

Run `cdk destroy` do remove entire stack or delete the stack manually. As we are using code aproach, it is recommended not to do things manually. ECR will remove all images, and S3 artifact bucket will also be removed.

    If, by any chance, something is removed manually and deployment is stuck in one of the famous stuck states, no need to contact support, just do the next steps in the AWS console.
    - Stop all tasks
    - Update the fargate service to previous revision(if applicable), if not, remove the service manually
    - Wait for stack to time out(around 1h) and than you can delete it
