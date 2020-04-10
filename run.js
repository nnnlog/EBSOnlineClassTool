process.env.TZ = "Asia/Seoul";

const readline = require("readline");
const url = require("url");
const axios = require("axios");

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

let baseURL, request;
let driver;
let schedule = [], cookies = [];

function startLecture() {
	//TODO: axios를 이용해 예약 시간이 되면 강의 시작 신호만 전송
}

function runSchedule() {
	let fin = [];
	//TODO: call startLecture();
	//TODO: 예약 시간 + 영상 시간이 되면 종료 신호 전송
	Promise.all(fin).then(() => {
		console.log("예약된 강의를 모두 수강하였습니다.")
		exit(0);
	});
}

function list() {
	return new Promise(async (resolve) => {
		console.log("강의 예약에 대하여 자세한 부분은 README.md를 참고해주세요.")
		console.log("예약하고자 하는 클래스 -> 강의 페이지에 들어갑니다.");
		console.log("날짜 형식 : y-m-d h:m:s (예시: 2020-4-10 11:28:0)");
		console.log("시간 형식 : h:m:s (예시: 11:28:0)");
		let n;
		while ((n = await input("계속 예약하시려면 원하는 강의에 들어가서 시간/날짜를, 더이상 예약할 강의가 없다면 N을 쳐주세요 : ")).toUpperCase() !== "N") {
			let current = new Date();
			if (isNaN(Date.parse(n)) && isNaN(Date.parse(n = `${current.getFullYear()}-${current.getMonth() + 1}-${current.getDate()} ${n}`))) {
				console.log("날짜 형식을 맞춰주세요.");
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
				schedule.push([current_url, Date.parse(n)]);
			} else {
				console.log("1번 탭에는 클래스 목록, 2번 탭에는 예약할 강의가 오도록 해주세요.");
			}
		}

		resolve();
	});
}

(async () => {
	driver = await new Builder().forBrowser('chrome').build();
	await driver.get("https://hoc.ebssw.kr/sso/loginView.do?loginType=onlineClass");

	await input("로그인을 완료하고 엔터를 눌러주세요.");
	let current_url = await driver.getCurrentUrl();
	if (current_url !== "https://hoc.ebssw.kr/onlineClass/reqst/onlineClassReqstInfoView.do") {
		console.log("로그인이 되지 않았습니다.");
		await exit(0);
	}
	await driver.executeScript(() => {
		return document.querySelectorAll(".list")[1].firstElementChild.firstElementChild.href;
	}).then(async (href) => {
		console.log("Detected Host : " + (baseURL = "https://" + url.parse(href).host));
		await driver.executeScript(() => location.replace(document.querySelectorAll(".list")[1].firstElementChild.firstElementChild.href));
		cookies = await driver.manage().getCookies();
		await driver.executeScript(() => history.back());
	});

	await list();

	request = axios.create({
		headers: {
			cookie: cookies.filter(v => v.domain === baseURL.substr("https://".length)).map(data => `${data.name}=${data.value}`).join("; ")
		}
	});

	//TODO: web driver 끄고 axios만을 이용해 셰션 유지 및 강의 시간 조절

	runSchedule();
})();