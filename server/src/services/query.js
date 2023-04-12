

const DEFAULT_PAGE_LIMIT = 0//默认的limit 0limit意味着返回全部
const DEFAULT_PAGE = 1//默认的page 1page意味着返回第一页
function getPagination(query){
    const limit = Math.abs(query.limit)|| DEFAULT_PAGE_LIMIT
    const page = Math.abs(query.page)|| DEFAULT_PAGE
    const skip = (page - 1) * limit //当我在第几页的时候 我应该跳过多少个
    return {
        limit,
        skip,
    }
}

module.exports = {
    getPagination,
}