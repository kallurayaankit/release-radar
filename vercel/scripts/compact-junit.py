"""Keep only case identity and outcome in the authenticated Actions artifact."""
import sys
import xml.etree.ElementTree as ET


def project(source, target):
    for item in source:
        if item.tag in ("testsuites", "testsuite"):
            child = ET.SubElement(target, item.tag, {"name": item.get("name", "")})
            project(item, child)
        elif item.tag == "testcase":
            name = item.attrib["name"]
            case = ET.SubElement(target, "testcase", {"name": name, "classname": item.get("classname", "")})
            for outcome in ("error", "failure", "skipped"):
                if item.find(outcome) is not None:
                    ET.SubElement(case, outcome)
                    break


if __name__ == "__main__":
    root = ET.parse(sys.argv[1]).getroot()
    if root.tag not in ("testsuites", "testsuite") or not root.findall(".//testcase"):
        raise ValueError("No JUnit test cases were produced.")
    output = ET.Element(root.tag, {"name": root.get("name", "")})
    project(root, output)
    ET.ElementTree(output).write(sys.argv[2], encoding="utf-8")
