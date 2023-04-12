// 导入axios
const axios = require('axios');

const launchesDatabase = require('./launches.mongo');
// 当我们想要外键怎么办？
// 直接model里面加约束 因为 nosql 不好加约束
const planets = require('./planets.mongo');

// const launches = new Map();
// 如何把这个自增常量也移到mongo里面去？
// let latestFlightNumber = 100;
// 用这个
const DEFAULT_FLIGHT_NUMBER = 100;

async function getLatestFlightNumber() {
    // find 找的是list
    // findOne 找的是一个
    // const latestLaunch = await launchesDatabase.findOne().
    // 下面的这个是他写的 但是我感觉他的顺序有问题,但是我写的会报错 我也不知道为什么他能这么写
    const latestLaunch = await launchesDatabase.findOne().sort('-flightNumber');
    // 如果没有就是直接返回默认值
    if (!latestLaunch) {
        return DEFAULT_FLIGHT_NUMBER;
    }
    return latestLaunch.flightNumber;
}
// 当有了spaceX api之后 我们就不需要这些测试数据了👇

// //我需要mapping到这些参数和注释中从spaceX api中获取的数据对应
// const launch = {
//     flightNumber: 100,//flight_number,
//     mission: 'Kepler Exploration X',//name
//     rocket: 'Explorer IS1',//rocket.name,
//     launchDate: new Date('December 27, 2030'),//date_local
//     target: 'Kepler-442 b',//他的数据没有 要我们定
//     customers: ['ZTM', 'NASA'],//payloads[0].customers
//     //加上这个变量 意味着我们可以取消这个
//     upcoming: true,//upcoming
//     // 加上这个变量 意味着我们可以知道这个任务是否成功
//     success: true,//success
// }
// // flightNumber作为key launch作为value
// // launches.set(launch.flightNumber, launch);
// // 他这里调用saveLaunch 为的是有一个起始的飞机任务
// saveLaunch(launch)


const SPACEX_API_URL = 'https://api.spacexdata.com/v4/launches/query';

// 把之前写在主体里面的封装成新的函数
async function populateLaunches() {
    console.log("downloading data")
    // 想都没想过post能请求
    // 但是老印问的问题给了我思路
    // post post以后会给你打回来
    // 类似这样的post请求确实能筛选
    //     POST /service/function { param1 : value1, param2 : value2 }
    // 第一个参数post的url 第二个参数是post的内容
    // query option 是指定的属性
    // query是过滤用的
    // populate是options 的属性
    const respose = await axios.post(SPACEX_API_URL, {
        // query 和option是过滤的选项
        // 这些query，option是spacex api的属性
        // 这些方法要根据spacex api的文档来写
        query: {},
        options: {

            pagination: false,
            // page: 2,
            // 这个是分页 你想要那页的数据
            // limit: 100,
            // 这个是每页的数据量
            populate: [
                {
                    path: 'rocket',
                    select: {
                        name: 1,
                    }
                },
                {
                    path: 'payloads',
                    select: {
                        customers: 1,
                    }
                }
            ]
        }
    })
    // 万一没拿到怎么办
    if (respose.status !== 200) {
        console.log('Problem downloading launch data')
        throw new Error('Launch data download failed')
    }

    // 通过axios 拿到response 然后开始mapping
    const launchDocs = respose.data.docs
    // response.data 是axios的一个属性
    // docs 是spacex api的一个属性
    // 为什么能这么写
    // {
    //     "docs": [
    //         {
    //             "fairings": {
    //                 "reused": false,
    //                 "recovery_attempt": false,
    //                 "recovered": false,
    //                 "ships": []
    //             },
    for (const launchDoc of launchDocs) {

        const payloads = launchDoc['payloads'];
        const customers = payloads.flatMap((payload) => {
            return payload['customers'];
        })
        const launch = {
            flightNumber: launchDoc['flight_number'],
            mission: launchDoc['name'],
            rocket: launchDoc['rocket']['name'],
            launchDate: launchDoc['date_local'],
            upcoming: launchDoc['upcoming'],
            success: launchDoc['success'],
            customers: customers,
        }
        console.log(`${launch.flightNumber} ${launch.mission}`)

        await saveLaunch(launch);
    }
}

// 添加开始和api互动的东西
async function loadLaunchData() {
    const firstLaunch = await findLaunch({
        flightNumber: 1,
        rocket: 'Falcon 1',
        mission: 'FalconSat',
    })
    if (firstLaunch) {
        console.log('Launch data already loaded')
    } else {
        await populateLaunches();
    }
//    进一步封装 把之前写的post请求数据的东西封装
}


// 上mongo
async function saveLaunch(launch) {

    // 把这个提出来 验证在不在planet 这个封装的计划发射里面

    //
    // await launchesDatabase.updateOne({
    // 用这个 这个更好 他用这个是因为updateOne会默认产生多余数据
    await launchesDatabase.findOneAndUpdate({
        // 找到就更新 launch 找不到就插入launch
        flightNumber: launch.flightNumber,
    }, launch, {
        upsert: true,
    })
//     filter: An object that specifies the query criteria for selecting the document(s)
//     to update. In this case, the filter is { flightNumber: launch.flightNumber },
//     which means the function will look for a document in the launches collection
//     that has a flightNumber property that matches the flightNumber property of
//     the launch object passed as an argument to the saveLaunch() function.
//
//     update: An object that contains the updated values to be applied to
//     the selected document(s). In this case, the launch object is passed
//     directly as the update argument, so all of its properties will be
//     updated in the matching document in the launches collection.
//
//     options: An object that contains optional settings for the update operation.
//     In this case, the upsert option is set to true, which means that
//     if no document is found that matches the filter, a new document
//     will be inserted with the launch object as its values.
}

async function findLaunch(filter) {
    return await launchesDatabase.findOne(filter);
}


// 这个函数是为了判断这个任务是否存在
// 开始用database替换掉map
async function existsLaunchWithId(launchId) {
    // launches是一个map
    // 不要用findById 因为我们的id是number,mongo的findById是mongo自己生成的Id
    // return await launchesDatabase.findOne({
    //     flightNumber: launchId,
    // });
    return await findLaunch({
        flightNumber: launchId,
    })
}


// 当我们找到了不要的以后 我们不是删除他 而是把他修改了另一个两个都是false的变量
// 开始改abortLaunchById
async function abortLaunchById(launchId) {
    // 最后一个参数没必要管 因为已经在前面进行了是否存在的判断
    // 这个只是为了把upcoming和success改成false
    const aborted = await launchesDatabase.updateOne({
        flightNumber: launchId,
    }, {
        upcoming: false,
        success: false,
    })
    // 这个是最新版的判断
    // 直接拿到修改的数量 如果修改的数量是1 就说明修改成功
    return aborted.modifiedCount === 1;

}


// 将所有转化model数据的工作放在model模块里面
// 只向外界暴露直接使用的方法
async function getAllLaunches(skip, limit) {
    // return Array.from(launches.values());
    // console.log(await launchesDatabase
    //     .find({}, {'_id': 0, '__v': 0}))
    return await launchesDatabase
        .find({}, {'_id': 0, '__v': 0})// 这个是为了不显示id和version
        .sort({'flightNumber': 1})// 这个是为了按照flightNumber排序 1是升序 -1是降序
        .skip(skip)// 这个是为了跳过前面20个
        .limit(limit)//这样的逻辑上先跳过前20 之后再取20个
}

// 开始添加post方法
// 这个launch 和上面的const launch 没有任何关系
// function addNewLaunch(launch) {
//     // 逻辑是用户传一个少三个属性的launch
//     // 我们这里默认给加上三个属性
//     latestFlightNumber++;
//     launches.set(
//         latestFlightNumber,
//         Object.assign(launch, {
//             // 这个launch 和上面的const launch 没有任何关系 这个只和形参launch有关系
//             // 这个assign 意思是给传入的参数 launch 添加了四个properties
//             upcoming: true,
//             success: true,
//             flightNumber: latestFlightNumber,
//             customer: ['ZTM', 'NASA'],
//         })
//     );
//
// }

// 上mongo 替换之前写的addNewLaunch
async function scheduleNewLaunch(launch) {

    // 这个是为了找到对应的planet
    // 需要target  和名字对应
    const planet = await planets.findOne({
        keplerName: launch.target,
    })
    // 加上这一行以后可以确保我们的任务是有目标的
    // 如果目标错误就会报错
    if (!planet) {
        throw new Error('No matching planet found');
    }

    // 和之前写的找航班号的方法交互
    const newFlightNumber = (await getLatestFlightNumber()) + 1;

    const newLaunch = Object.assign(launch, {
        upcoming: true,
        success: true,
        customers: ['ZTM', 'NASA'],
        flightNumber: newFlightNumber,
    })
    await saveLaunch(newLaunch);
}

//将launches暴露出去
module.exports = {
    getAllLaunches,
    // addNewLaunch,
    scheduleNewLaunch,
    existsLaunchWithId,
    abortLaunchById,
    loadLaunchData
}