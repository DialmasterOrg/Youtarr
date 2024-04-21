#!/bin/bash
# This can only be used by the package maintainer

echo "Please merge to main and then use the github action to create a release"
echo "The code below is deprecated but retained for reference."
exit 0


# Check for required tools
for tool in git docker npm; do
  if ! which $tool &> /dev/null; then
    echo "$tool is not available, but is required to run this script. Please install $tool."
    exit 1
  fi
done

# Ensure we're on the 'main' branch
current_branch=$(git symbolic-ref --short HEAD)
if [ "$current_branch" != "main" ]; then
    echo "You're currently on the '$current_branch' branch. Please switch to 'main' branch before creating a release."
    exit 1
fi
# Retrieve and print the current git version
current_version=$(git describe --tags `git rev-list --tags --max-count=1`)
echo "Current version is: $current_version"

# Ask for the new version number
read -p "Enter the new version number: " new_version

npm version $new_version --no-git-tag-version
cd client
npm version $new_version --no-git-tag-version
cd ..

# Commit the changes
git add package.json
git add client/package.json
git commit -m "Bump version to $new_version"

cd client
npm run build
cd ..

# Build the Docker image with the new version tag
docker build -t dialmaster/youtarr:$new_version .

# Tag the new version as latest
docker tag dialmaster/youtarr:$new_version dialmaster/youtarr:latest

# Push the new version and the latest tag to Docker repository
docker push dialmaster/youtarr:$new_version
docker push dialmaster/youtarr:latest

# Tag the commit in git
git tag $new_version

# Push the tags and commits to the repository
git push
git push --tags