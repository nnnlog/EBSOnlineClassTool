process.env.TZ = "Asia/Seoul";

const readline = require("readline");
const url = require("url");
const axios = require("axios");
const cheerio = require("cheerio");

require("chromedriver");
const {Builder, By, Key, until} = require('selenium-webdriver');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

const input = query => new Promise(resolve => {
	rl.question(query, ans => resolve(ans));
});

const exit = async (code) => {
	await driver.session_.then(() => driver.quit()).catch(() => {
	});
	process.exit(code);
};
let UserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Whale/2.7.97.12 Safari/537.36";
let Lang = "ko_KR";

// 정상적인 웹 브라우저 모방 코드
let ExtensionsOne = "Object.defineProperty(navigator, 'plugins', {get: function() {return[1, 2, 3, 4, 5]}})";
let ExtensionsTwo = "Object.defineProperty(navigator, 'languages', {get: function() {return ['ko-KR', 'ko']}})";

// headless 적용시 활성화 추천
// let ExtensionsThree = "const getParameter = WebGLRenderingContext.getParameter;WebGLRenderingContext.prototype.getParameter = function(parameter) {if (parameter === 37445) {return 'NVIDIA Corporation'} if (parameter === 37446) {return 'NVIDIA GeForce GTX 980 Ti OpenGL Engine';}return getParameter(parameter);};";

let baseURL, session_url, request;
let driver;
let schedule = [], cookies = [];

async function sendSignal(lecture_param, revivTime) {
	revivTime += 120;
	let res = (await request.post("/mypage/userlrn/lctreLrnSave.do", `${lecture_param}&lrnTime=${120}&lastRevivLC=${revivTime}`)).data;
	if (res.result !== "SUCCESS") {
		return Promise.reject(res);
	}

	return Promise.resolve();
}

async function readLectureData(url, atnlcNo) {
	let $ = cheerio.load((await request.post(`${url.replace("hmpgLctrumView.do", "").split("?").shift()}/hmpgLctrumTabView.do`, url.split("?").pop() + `&atnlcNo=${atnlcNo}`)).data);
	let lecture = [];

	await Promise.all(Object.values($(".btn-md.fr.way")).map(async (element) => {
		if (element.children === undefined || element.children[0] === undefined || element.children[0].data === undefined) return Promise.resolve();
		if (element.children[0].data === "학습전" || element.children[0].data.indexOf("진행중") > -1) {
			let params = $(element.parent).find("a").attr("href").replace(/(javascript:showNewLrnWindow\( |\);|')/gi, '').split(', ');
			let data = (await request.post("/mypage/userlrn/userLrnMvpView.do", url.split("?").pop() + `&atnlcNo=${atnlcNo}&lctreSn=${params[0]}&cntntsTyCode=001`)).data;
			let cut = data.indexOf('var revivTime = Number( "') + 'var revivTime = Number( "'.length;
			let fin = data.indexOf('"', cut + 1);
			let revivTime = data.substr(cut, fin - cut);

			cut = data.indexOf('var cntntsTyCode = "') + 'var cntntsTyCode = "'.length;
			fin = data.indexOf('";', cut + 1);
			let cntntsTyCode = data.substr(cut, fin - cut);

			lecture.push([url.split("?").pop() + `&atnlcNo=${atnlcNo}&lctreSn=${params[0]}&lctreSeCode=LCTRE&cntntsTyCode=${cntntsTyCode}&revivTime=${revivTime}`, parseInt(revivTime)]);
		}

		return Promise.resolve();
	}));

	return lecture;
}

function runSchedule() {
	let promise = [];

	for (let playlist of schedule) {
		for (let lecture of playlist[0]) {
			promise.push(new Promise(r => setTimeout(async () => {
				console.log(`[${(new Date()).toLocaleString()} > 강의 시작 신호 전송 (${lecture[0]})`);
				for (let i = Math.ceil(lecture[1] / 120); i >= 0; i--) {
					await sendSignal(...lecture, 120 * (Math.ceil(lecture[1] / 120) - i)).catch(ret => {
						console.log(`[${(new Date()).toLocaleString()} > 오류가 발생했습니다:`);
						console.log(ret);
					});
					i && await new Promise(r => setTimeout(() => r(), 120 * 1000));
				}
				console.log(`[${(new Date()).toLocaleString()} > 강의 종료 신호 전송 (${lecture[0]})`);
			}, Math.max(0, playlist[1] - Date.now()))));
		}
	}

	Promise.all(promise).then(() => {
		console.log("예약된 강의를 모두 수강하였습니다.")
		exit(0);
	});
}

function list() {
	return new Promise(async (resolve) => {
		console.log("강의 예약에 대하여 자세한 부분은 README.md를 참고해주세요.")
		console.log("예약하고자 하는 클래스 -> 강의 페이지에 들어갑니다.");
		console.log("날짜 형식 : y-m-d h:m:s (예시: 2020-4-10 11:28:0)");
		console.log("시간 형식 : h:m:s (예시: 11:28:0 또는 11:28)");
		let n;
		while ((n = await input("계속 예약하시려면 원하는 강의에 들어가서 시간/날짜를, 더이상 예약할 강의가 없다면 N을 쳐주세요 : ")).toUpperCase() !== "N") {
			let current = new Date();
			if (isNaN(Date.parse(n)) && (n.trim() === "" || isNaN(Date.parse(n = `${current.getFullYear()}-${current.getMonth() + 1}-${current.getDate()} ${n}`)))) {
				console.log("날짜 형식을 맞춰주세요.");
				continue;
			}
			let time = Date.parse(n);
			if (time <= Date.now()) {
				console.log("올바르지 않은 시간입니다.");
				continue;
			}
			let opened_window = await driver.getAllWindowHandles();
			if (opened_window.length !== 2) {
				console.log("1번 탭에는 클래스 목록, 2번 탭에는 예약할 강의가 오도록 해주세요.");
				continue;
			}
			await driver.switchTo().window(opened_window[1]);
			let current_url = await driver.getCurrentUrl();
			if (url.parse(current_url).path.split("/").pop().split("?").shift() === "hmpgLctrumView.do") {
				let temp;
				schedule.push([temp = await readLectureData(current_url, await driver.executeScript(() => document.getElementById("atnlcNo").value)), time]);
				console.log(`${temp.length}개의 강의를 ${time.toLocaleString()}에 예약했습니다.`)

				console.log(temp)
			} else {
				console.log("1번 탭에는 클래스 목록, 2번 탭에는 예약할 강의가 오도록 해주세요.");
			}
		}

		resolve();
	});
}

(async () => {
	driver = await new Builder().withCapabilities(
		{
			'user-agent': UserAgent,
			'lang': Lang
		}
	).forBrowser('chrome').build();
	await driver.get("https://oc.ebssw.kr/");
	await driver.executeScript(ExtensionsOne);
	await driver.executeScript(ExtensionsTwo);
	// await driver.executeScript(ExtensionsThree);

	await input("로그인을 완료하고 엔터를 눌러주세요.");
	await driver.close();
	let opened_window = await driver.getAllWindowHandles();
	await driver.switchTo().window(opened_window[0]);
	let current_url = await driver.getCurrentUrl();
	await driver.executeScript(ExtensionsOne);
	await driver.executeScript(ExtensionsTwo);
	// await driver.executeScript(ExtensionsThree);
	if (current_url.indexOf("onlineClassReqstInfoView.do") < 0) {
		console.log("로그인이 되지 않았습니다.");
		await exit(0);
	}

	await driver.executeScript(() => {
		return document.querySelectorAll(".list")[1].firstElementChild.firstElementChild.href;
	}).then(async (href) => {
		session_url = href;

		console.log("Detected Host : " + (baseURL = "https://" + url.parse(href).host));
		await driver.executeScript(() => location.replace(document.querySelectorAll(".list")[1].firstElementChild.firstElementChild.href));
		cookies = await driver.manage().getCookies();
		await driver.executeScript(() => location.replace(location.origin + "/onlineClass/reqst/onlineClassReqstInfoView.do"));
	});

	request = axios.create({
		headers: {
			cookie: cookies.filter(v => v.domain === baseURL.substr("https://".length)).map(data => `${data.name}=${data.value}`).join("; "),
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
		},
		baseURL: baseURL
	});

	await list();
	await driver.quit();

	//TODO: axios만을 이용해 셰션 유지

	runSchedule();
})();