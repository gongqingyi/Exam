git rev-list --reverse origin/main..main | awk 'NR % 100 == 0' | while read commit; do
    echo "正在推送到 $commit ..."
    git push origin $commit:refs/heads/main
done
# 最后推送剩余的全部
git push origin main:main
